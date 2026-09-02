import { INSTRUCT_SKILLS, runCoachTurn, type CoachTurnInput, type CoachTurnResult } from '../coach/agent.js';
import type { CoachStreamEvent } from '@habits-coach/shared';
import { config } from '../config.js';
import {
  createSupabaseInstructActionsDb,
  type InstructActionRecord,
  type InstructActionsDb,
} from './instructActions.js';

type RunTurn = (input: CoachTurnInput, onEvent: (event: CoachStreamEvent) => void) => Promise<CoachTurnResult>;

export interface InstructQueueDeps {
  db: InstructActionsDb;
  runTurn: RunTurn;
}

export interface EnqueueInput {
  userId: string;
  transcript: string;
  timezone: string;
  reinstructOf?: string;
  /** The id the client gave this instruction, so a repeat resolves to one row. */
  id?: string;
}

const now = () => new Date().toISOString();

/**
 * A turn that has not answered by now is wedged rather than slow: `turnCapMs`
 * is the coach's own cap, and this is the outer one that holds even when the
 * abort does not land. The row fails and the chain moves on.
 */
const TURN_DEADLINE_MS = config.coach.turnCapMs + 30_000;

/** `working` for longer than this and no live turn can still be behind it. */
const STALE_WORKING_MS = TURN_DEADLINE_MS * 2;

/**
 * The outermost bound: one turn plus the writes around it. Past this the chain
 * link is abandoned so the user's next instruction is not held behind it, and
 * the sweep picks up whatever it left.
 */
const LINK_DEADLINE_MS = TURN_DEADLINE_MS + 60_000;

/** How often the queue looks for work that nothing is draining. */
export const SWEEP_INTERVAL_MS = 60_000;

/**
 * A promise that never resolves and rejects at `ms`, with its timer's off
 * switch. Every await inside the serial chain needs one: a link that hangs
 * parks every instruction behind it, for as long as it hangs (HAB-190).
 */
function deadline(ms: number, message: string, onExpire?: () => void) {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onExpire?.();
      reject(new Error(message));
    }, ms);
  });
  return { expiry, cancel: () => clearTimeout(timer) };
}

/** The first complete line of what has streamed so far, or null until one exists. */
export function firstCompleteLine(streamed: string): string | null {
  const index = streamed.indexOf('\n');
  if (index === -1) return null;
  const line = streamed.slice(0, index).trim();
  return line || null;
}

/**
 * The act turn's reply, minus the working line it opened with: the working
 * line is what `summary` already holds, not part of the result.
 */
export function stripWorkingLine(text: string, workingLine: string | null): string {
  const trimmed = text.trim();
  if (!workingLine) return trimmed;
  if (!trimmed.startsWith(workingLine)) return trimmed;
  return trimmed.slice(workingLine.length).trim();
}

/**
 * What a turn that wrote nothing gets recorded as. A question and a `NOTHING:`
 * line are honest outcomes and read as themselves; anything else is the coach
 * describing work it did not do, and the row has to lead with the only thing
 * the user needs from it — that nothing changed — before quoting the claim.
 */
export function noWriteError(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'The coach made no changes.';
  const nothing = /^NOTHING:\s*/i.exec(trimmed);
  if (nothing) return trimmed.slice(nothing[0].length).trim() || 'Nothing to do.';
  if (trimmed.endsWith('?')) return trimmed;
  return `Nothing changed — the coach described work it did not do:\n${trimmed}`;
}

function rewindPrompt(row: InstructActionRecord, direction: 'undo' | 'redo'): string {
  const calls = JSON.stringify(row.tool_calls ?? [], null, 2);
  const verb =
    direction === 'undo'
      ? 'Undo exactly these recorded actions, most recent first — restore what they changed to its prior state'
      : 'Redo exactly these recorded actions, oldest first';
  return [
    `${verb}. They were recorded from the instruction "${row.transcript}".`,
    '',
    calls,
    '',
    'Use the read tools to find the rows they touched before writing. Make no other change.',
    'Reply with exactly `Undone.` (or `Redone.`) when fully reversed; otherwise one line starting',
    '`Partly undone:` (or `Partly redone:`) naming what could not be restored and why.',
  ].join('\n');
}

/**
 * The fire-and-forget queue behind hold-to-instruct (HAB-134). Sequential per
 * user — instructions depend on each other, and a rewind must never race a
 * write — with every state change recorded on `instruct_actions`, so the app
 * re-derives all UI from the log and a process restart resumes cleanly.
 */
export function createInstructQueue({ db, runTurn }: InstructQueueDeps) {
  /** Per-user tail of the serial chain; all turns for a user run behind it. */
  const chains = new Map<string, Promise<void>>();
  /** The in-flight turn per action id, so cancel can abort it. */
  const activeTurns = new Map<string, AbortController>();
  /** Action ids with a rewind/restore turn in flight, so a double tap is one turn. */
  const rewinding = new Set<string>();

  function schedule(userId: string, work: () => Promise<void>): Promise<void> {
    const next = (chains.get(userId) ?? Promise.resolve())
      .then(() => {
        // Whatever hangs — a socket, the SDK — the chain is not held by it.
        const link = deadline(LINK_DEADLINE_MS, `Instruct chain for ${userId} was abandoned; the sweep will pick it up`);
        return Promise.race([work(), link.expiry]).finally(link.cancel);
      })
      .catch((error) => {
        console.error('Instruct queue:', error);
      });
    chains.set(userId, next);
    return next;
  }

  const kick = (userId: string) => schedule(userId, () => drain(userId));

  async function drain(userId: string): Promise<void> {
    while (true) {
      const queued = await db.oldestQueued(userId);
      if (!queued) return;
      const claimed = await db.transition(queued.id, ['queued'], { status: 'working', started_at: now() });
      if (!claimed) continue; // canceled between read and claim; take the next one
      await runAction(claimed);
    }
  }

  async function buildActPrompt(row: InstructActionRecord): Promise<string> {
    if (!row.reinstruct_of) return `/instruct ${row.transcript}`;
    const original = await db.get(row.reinstruct_of);
    if (!original) return `/instruct ${row.transcript}`;
    const outcome = original.result ?? original.error ?? 'no recorded outcome';
    return [
      `/instruct ${row.transcript}`,
      '',
      `This corrects an earlier instruction. Original: "${original.transcript}" → ${outcome}.`,
      'Apply the correction against what that instruction did, not from scratch.',
    ].join('\n');
  }

  async function runAction(row: InstructActionRecord): Promise<void> {
    const controller = new AbortController();
    activeTurns.set(row.id, controller);
    let streamed = '';
    let workingLine: string | null = null;
    let timedOut = false;
    // The abort is the polite half; the race is the half that always works.
    const turnDeadline = deadline(TURN_DEADLINE_MS, 'The coach did not answer in time.', () => {
      timedOut = true;
      controller.abort();
    });
    const onEvent = (event: CoachStreamEvent) => {
      if (event.type !== 'text' || workingLine) return;
      streamed += event.delta;
      workingLine = firstCompleteLine(streamed);
      // Best-effort: the pill reads it while the turn runs; the turn does not wait on it.
      if (workingLine) void db.transition(row.id, ['working'], { summary: workingLine }).catch(() => {});
    };

    try {
      const result = await Promise.race([
        runTurn(
          {
            userId: row.user_id,
            prompt: await buildActPrompt(row),
            timezone: row.timezone,
            claudeSessionId: null,
            skills: INSTRUCT_SKILLS,
            readOnly: false,
            signal: controller.signal,
          },
          onEvent
        ),
        turnDeadline.expiry,
      ]);

      if (result.outcome.type === 'error') {
        await db.transition(row.id, ['working'], { status: 'failed', error: result.outcome.message, finished_at: now() });
        return;
      }

      const text = stripWorkingLine(result.outcome.message, workingLine);
      if (result.writeToolCalls.length > 0) {
        await db.transition(row.id, ['working'], {
          status: 'applied',
          result: text || workingLine || 'Done.',
          tool_calls: result.writeToolCalls,
          claude_session_id: result.claudeSessionId,
          finished_at: now(),
        });
      } else {
        // Nothing was written: the reply is the coach's question, its reason,
        // or — never to be passed on as if it were true — a claim to have acted.
        await db.transition(row.id, ['working'], {
          status: 'failed',
          error: noWriteError(text),
          finished_at: now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A timeout aborts the turn too, so it has to be read before the abort.
      if (!timedOut && controller.signal.aborted) {
        await db.transition(row.id, ['working'], { status: 'canceled', finished_at: now() });
      } else {
        if (timedOut) console.error(`Instruct action ${row.id} timed out after ${TURN_DEADLINE_MS}ms`);
        await db.transition(row.id, ['working'], { status: 'failed', error: message, finished_at: now() });
      }
    } finally {
      turnDeadline.cancel();
      activeTurns.delete(row.id);
    }
  }

  async function runRewind(row: InstructActionRecord, direction: 'undo' | 'redo'): Promise<void> {
    const [fromStatus, toStatus] =
      direction === 'undo' ? (['applied', 'rewound'] as const) : (['rewound', 'applied'] as const);
    try {
      const result = await runTurn(
        {
          userId: row.user_id,
          prompt: rewindPrompt(row, direction),
          timezone: row.timezone,
          claudeSessionId: null,
          skills: INSTRUCT_SKILLS,
          readOnly: false,
          signal: undefined,
        },
        () => {}
      );
      if (result.outcome.type === 'error') {
        console.error(`Instruct ${direction} failed for ${row.id}: ${result.outcome.message}`);
        return; // status untouched: the row still reflects what the data actually says
      }
      const reply = result.outcome.message.trim();
      // The verdict is the reply's last line; a model sometimes narrates first.
      const lastLine = reply.split('\n').map((line) => line.trim()).filter(Boolean).at(-1) ?? '';
      const clean = /^(undone|redone)\.?$/i.test(lastLine);
      await db.transition(row.id, [fromStatus], {
        status: toStatus,
        // A partial reversal reports what it could not restore in `result`.
        ...(clean ? {} : { result: reply }),
        finished_at: now(),
      });
    } finally {
      rewinding.delete(row.id);
    }
  }

  return {
    async enqueue({ userId, transcript, timezone, reinstructOf, id }: EnqueueInput): Promise<InstructActionRecord> {
      const row = await db.insert({
        ...(id ? { id } : {}),
        user_id: userId,
        transcript,
        timezone,
        reinstruct_of: reinstructOf ?? null,
      });
      kick(userId);
      return row;
    },

    /** failed → queued, wiped back to a fresh attempt. */
    async retry(userId: string, id: string): Promise<InstructActionRecord | null> {
      const row = await db.get(id);
      if (!row || row.user_id !== userId) return null;
      const requeued = await db.transition(id, ['failed'], {
        status: 'queued',
        error: null,
        summary: null,
        result: null,
        started_at: null,
        finished_at: null,
      });
      if (requeued) kick(userId);
      return requeued ?? row;
    },

    /** queued → canceled outright; working → abort the turn, which lands canceled. */
    async cancel(userId: string, id: string): Promise<InstructActionRecord | null> {
      const row = await db.get(id);
      if (!row || row.user_id !== userId) return null;
      const canceled = await db.transition(id, ['queued'], { status: 'canceled', finished_at: now() });
      if (canceled) return canceled;
      if (row.status === 'working') {
        const active = activeTurns.get(id);
        if (active) {
          active.abort();
          return row; // the runner records `canceled` when the abort lands
        }
        return db.transition(id, ['working'], { status: 'canceled', finished_at: now() });
      }
      return row;
    },

    /** failed → canceled: the user has seen the failure and let it go. */
    async dismiss(userId: string, id: string): Promise<InstructActionRecord | null> {
      const row = await db.get(id);
      if (!row || row.user_id !== userId) return null;
      return (await db.transition(id, ['failed'], { status: 'canceled', finished_at: now() })) ?? row;
    },

    /** One turn that undoes (`applied` → `rewound`) or redoes (`rewound` → `applied`) the recorded calls. */
    async rewind(userId: string, id: string, direction: 'undo' | 'redo'): Promise<InstructActionRecord | null> {
      const row = await db.get(id);
      if (!row || row.user_id !== userId) return null;
      const from = direction === 'undo' ? 'applied' : 'rewound';
      if (row.status !== from || !row.tool_calls?.length || rewinding.has(id)) return row;
      rewinding.add(id);
      // Behind the same chain as the act turns: a rewind never races a write.
      void schedule(userId, () => runRewind(row, direction));
      return row;
    },

    /** Boot recovery: a turn that died with its process runs again from `queued`. */
    async resume(): Promise<void> {
      await db.resetStaleWorking();
      for (const userId of await db.queuedUserIds()) kick(userId);
    },

    /**
     * The backstop, on `SWEEP_INTERVAL_MS`. Every await in the chain has a
     * deadline now, so a link fails instead of hanging — but a link that failed
     * leaves its row queued with nothing left to kick it, and a turn abandoned
     * mid-flight leaves a row `working` that no one will finish. Neither should
     * wait for the next restart.
     */
    async sweep(): Promise<void> {
      await db.resetStaleWorking(new Date(Date.now() - STALE_WORKING_MS).toISOString());
      for (const userId of await db.queuedUserIds()) kick(userId);
    },

    /** Settles when every scheduled turn for the user has finished. Tests only. */
    idle(userId: string): Promise<void> {
      return chains.get(userId) ?? Promise.resolve();
    },
  };
}

export type InstructQueue = ReturnType<typeof createInstructQueue>;

let queue: InstructQueue | null = null;

/** The process-wide queue the routes and the boot hook share. */
export function instructQueue(): InstructQueue {
  queue ??= createInstructQueue({ db: createSupabaseInstructActionsDb(), runTurn: runCoachTurn });
  return queue;
}
