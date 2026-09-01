import { describe, expect, it } from 'vitest';
import type { CoachStreamEvent } from '@habits-coach/shared';
import type { CoachTurnInput, CoachTurnResult } from '../coach/agent.js';
import type { InstructActionPatch, InstructActionRecord, InstructActionsDb } from './instructActions.js';
import { createInstructQueue, firstCompleteLine, stripWorkingLine } from './instructQueue.js';

const USER = 'user-1';

function createMemoryDb() {
  const rows = new Map<string, InstructActionRecord>();
  let sequence = 0;

  const db: InstructActionsDb = {
    async insert(row) {
      const record: InstructActionRecord = {
        id: `action-${++sequence}`,
        status: 'queued',
        summary: null,
        result: null,
        error: null,
        tool_calls: null,
        claude_session_id: null,
        created_at: new Date(sequence).toISOString(),
        started_at: null,
        finished_at: null,
        ...row,
      };
      rows.set(record.id, record);
      return record;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async transition(id, from, patch: InstructActionPatch) {
      const row = rows.get(id);
      if (!row || !from.includes(row.status)) return null;
      const next = { ...row, ...patch };
      rows.set(id, next);
      return next;
    },
    async oldestQueued(userId) {
      return (
        [...rows.values()]
          .filter((row) => row.user_id === userId && row.status === 'queued')
          .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
      );
    },
    async list(userId) {
      return [...rows.values()].filter((row) => row.user_id === userId);
    },
    async resetStaleWorking() {
      for (const row of rows.values()) {
        if (row.status === 'working') {
          rows.set(row.id, { ...row, status: 'queued', started_at: null, summary: null });
        }
      }
    },
    async queuedUserIds() {
      return [...new Set([...rows.values()].filter((r) => r.status === 'queued').map((r) => r.user_id))];
    },
  };

  return { db, rows };
}

type Turn = (input: CoachTurnInput, onEvent: (event: CoachStreamEvent) => void) => Promise<CoachTurnResult>;

/** A runTurn whose behaviour each test scripts, one function per expected turn. */
function scriptedTurns(...turns: Turn[]): { runTurn: Turn; calls: CoachTurnInput[] } {
  const calls: CoachTurnInput[] = [];
  return {
    calls,
    runTurn: (input, onEvent) => {
      calls.push(input);
      const turn = turns.shift();
      if (!turn) throw new Error('runTurn called more times than the test scripted');
      return turn(input, onEvent);
    },
  };
}

const done = (message: string, writeToolCalls: CoachTurnResult['writeToolCalls'] = []): CoachTurnResult => ({
  outcome: { type: 'done', message },
  claudeSessionId: 'session-1',
  writeToolCalls,
});

const MOVE_CALL = { name: 'update_task', input: { id: 't1', scheduledTime: '18:00' } };

function enqueue(queue: ReturnType<typeof createInstructQueue>, transcript = 'move gym to 6pm') {
  return queue.enqueue({ userId: USER, transcript, timezone: 'Europe/Madrid' });
}

describe('instruct queue', () => {
  it('runs an enqueued instruction to applied, recording the write calls', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn, calls } = scriptedTurns(async (input, onEvent) => {
      onEvent({ type: 'text', delta: "Moving 'Gym' to 6:00 PM…\n" });
      return done("Moving 'Gym' to 6:00 PM…\nMoved 'Gym' to 6:00 PM\n- Moved Gym from 5:00 to 6:00 PM", [MOVE_CALL]);
    });
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);

    const final = rows.get(row.id)!;
    expect(final.status).toBe('applied');
    expect(final.summary).toBe("Moving 'Gym' to 6:00 PM…");
    expect(final.result).toBe("Moved 'Gym' to 6:00 PM\n- Moved Gym from 5:00 to 6:00 PM");
    expect(final.tool_calls).toEqual([MOVE_CALL]);
    expect(final.claude_session_id).toBe('session-1');
    expect(final.finished_at).not.toBeNull();
    expect(calls[0].prompt).toBe('/instruct move gym to 6pm');
    expect(calls[0].readOnly).toBe(false);
  });

  it('fails a turn that wrote nothing, keeping the reply as the error', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(async () => done('Which run — morning or evening?'));
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);

    const final = rows.get(row.id)!;
    expect(final.status).toBe('failed');
    expect(final.error).toBe('Which run — morning or evening?');
  });

  it('fails a turn whose outcome is an error', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(async () => ({
      outcome: { type: 'error', message: 'Claude is having trouble right now.' },
      claudeSessionId: null,
      writeToolCalls: [],
    }));
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);

    expect(rows.get(row.id)!.status).toBe('failed');
    expect(rows.get(row.id)!.error).toBe('Claude is having trouble right now.');
  });

  it('runs a burst strictly in order, one at a time', async () => {
    const { db } = createMemoryDb();
    const order: string[] = [];
    const turn = (label: string): Turn => async () => {
      order.push(`start ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end ${label}`);
      return done(`${label} done`, [MOVE_CALL]);
    };
    const { runTurn } = scriptedTurns(turn('a'), turn('b'), turn('c'));
    const queue = createInstructQueue({ db, runTurn });

    await enqueue(queue, 'a');
    await enqueue(queue, 'b');
    await enqueue(queue, 'c');
    await queue.idle(USER);

    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('a failure does not block the rest of the queue', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(
      async () => {
        throw new Error('boom');
      },
      async () => done('ok', [MOVE_CALL])
    );
    const queue = createInstructQueue({ db, runTurn });

    const first = await enqueue(queue, 'first');
    const second = await enqueue(queue, 'second');
    await queue.idle(USER);

    expect(rows.get(first.id)!.status).toBe('failed');
    expect(rows.get(first.id)!.error).toBe('boom');
    expect(rows.get(second.id)!.status).toBe('applied');
  });

  it('retry re-queues a failed action from a clean slate and runs it', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(
      async () => {
        throw new Error('boom');
      },
      async () => done('ok', [MOVE_CALL])
    );
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    expect(rows.get(row.id)!.status).toBe('failed');

    await queue.retry(USER, row.id);
    await queue.idle(USER);

    const final = rows.get(row.id)!;
    expect(final.status).toBe('applied');
    expect(final.error).toBeNull();
  });

  it('cancel flips a queued action to canceled without running it', async () => {
    const { db, rows } = createMemoryDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { runTurn } = scriptedTurns(async () => {
      await gate;
      return done('ok', [MOVE_CALL]);
    });
    const queue = createInstructQueue({ db, runTurn });

    const running = await enqueue(queue, 'running');
    const waiting = await enqueue(queue, 'waiting');
    await queue.cancel(USER, waiting.id);
    release();
    await queue.idle(USER);

    expect(rows.get(waiting.id)!.status).toBe('canceled');
    expect(rows.get(running.id)!.status).toBe('applied');
  });

  it('cancel aborts a working turn, which lands canceled, not failed', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(
      (input) =>
        new Promise((_resolve, reject) => {
          input.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        })
    );
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(rows.get(row.id)!.status).toBe('working');

    await queue.cancel(USER, row.id);
    await queue.idle(USER);

    expect(rows.get(row.id)!.status).toBe('canceled');
    expect(rows.get(row.id)!.error).toBeNull();
  });

  it('dismiss flips failed to canceled and nothing else', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(async () => {
      throw new Error('boom');
    });
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    await queue.dismiss(USER, row.id);

    expect(rows.get(row.id)!.status).toBe('canceled');

    // A second dismiss is a no-op, not an error.
    const again = await queue.dismiss(USER, row.id);
    expect(again!.status).toBe('canceled');
  });

  it('rewind runs an undo turn against the recorded calls and lands rewound', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn, calls } = scriptedTurns(
      async () => done('Moved it\n- Moved Gym', [MOVE_CALL]),
      async () => done('Undone.')
    );
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    await queue.rewind(USER, row.id, 'undo');
    await queue.idle(USER);

    const final = rows.get(row.id)!;
    expect(final.status).toBe('rewound');
    // A clean undo keeps the original result for the struck-through label.
    expect(final.result).toBe('Moved it\n- Moved Gym');
    expect(calls[1].prompt).toContain('Undo exactly these recorded actions');
    expect(calls[1].prompt).toContain('update_task');
  });

  it('a partial rewind reports what it could not restore in result', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(
      async () => done('Deleted it\n- Deleted the duplicate', [{ name: 'delete_task', input: { id: 't9' } }]),
      async () => done('Partly undone: delete_task cannot be reversed; the task is gone.')
    );
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    await queue.rewind(USER, row.id, 'undo');
    await queue.idle(USER);

    expect(rows.get(row.id)!.status).toBe('rewound');
    expect(rows.get(row.id)!.result).toBe('Partly undone: delete_task cannot be reversed; the task is gone.');
  });

  it('restore runs a redo turn and lands applied again', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn, calls } = scriptedTurns(
      async () => done('Moved it', [MOVE_CALL]),
      async () => done('Undone.'),
      async () => done('Redone.')
    );
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    await queue.rewind(USER, row.id, 'undo');
    await queue.idle(USER);
    await queue.rewind(USER, row.id, 'redo');
    await queue.idle(USER);

    expect(rows.get(row.id)!.status).toBe('applied');
    expect(calls[2].prompt).toContain('Redo exactly these recorded actions');
  });

  it('rewind refuses the wrong starting status', async () => {
    const { db, rows } = createMemoryDb();
    const { runTurn } = scriptedTurns(async () => {
      throw new Error('boom');
    });
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);
    expect(rows.get(row.id)!.status).toBe('failed');

    await queue.rewind(USER, row.id, 'undo');
    await queue.idle(USER);
    expect(rows.get(row.id)!.status).toBe('failed'); // untouched, and no extra turn ran
  });

  it('a correction turn carries the original transcript and result as context', async () => {
    const { db } = createMemoryDb();
    const { runTurn, calls } = scriptedTurns(
      async () => done('Moved Gym to 6:00 PM', [MOVE_CALL]),
      async () => done('Moved Gym to 7:00 PM', [MOVE_CALL])
    );
    const queue = createInstructQueue({ db, runTurn });

    const original = await enqueue(queue, 'move gym to 6pm');
    await queue.idle(USER);
    await queue.enqueue({
      userId: USER,
      transcript: 'no, 7pm',
      timezone: 'Europe/Madrid',
      reinstructOf: original.id,
    });
    await queue.idle(USER);

    expect(calls[1].prompt).toContain('/instruct no, 7pm');
    expect(calls[1].prompt).toContain('"move gym to 6pm"');
    expect(calls[1].prompt).toContain('Moved Gym to 6:00 PM');
  });

  it('resume resets stale working rows and drains them', async () => {
    const { db, rows } = createMemoryDb();
    // A row the last process died on: status `working`, nobody running it.
    const stale = await db.insert({
      user_id: USER,
      transcript: 'move gym',
      timezone: 'Europe/Madrid',
      reinstruct_of: null,
    });
    await db.transition(stale.id, ['queued'], { status: 'working', started_at: new Date().toISOString() });

    const { runTurn } = scriptedTurns(async () => done('ok', [MOVE_CALL]));
    const queue = createInstructQueue({ db, runTurn });
    await queue.resume();
    await queue.idle(USER);

    expect(rows.get(stale.id)!.status).toBe('applied');
  });

  it('refuses to act on another user’s action', async () => {
    const { db } = createMemoryDb();
    const { runTurn } = scriptedTurns(async () => done('ok', [MOVE_CALL]));
    const queue = createInstructQueue({ db, runTurn });

    const row = await enqueue(queue);
    await queue.idle(USER);

    expect(await queue.cancel('someone-else', row.id)).toBeNull();
    expect(await queue.retry('someone-else', row.id)).toBeNull();
    expect(await queue.rewind('someone-else', row.id, 'undo')).toBeNull();
  });
});

describe('reply parsing helpers', () => {
  it('firstCompleteLine waits for a newline', () => {
    expect(firstCompleteLine('Moving')).toBeNull();
    expect(firstCompleteLine('Moving…\nrest')).toBe('Moving…');
    expect(firstCompleteLine('\n\n')).toBeNull();
  });

  it('stripWorkingLine removes only the line summary already holds', () => {
    expect(stripWorkingLine('Moving…\nMoved it', 'Moving…')).toBe('Moved it');
    expect(stripWorkingLine('Moved it', null)).toBe('Moved it');
    expect(stripWorkingLine('Moved it', 'Moving…')).toBe('Moved it');
  });
});
