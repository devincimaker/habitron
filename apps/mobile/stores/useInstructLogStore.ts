import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { getTodayDate, type InstructActionRow } from '@habits-coach/shared';
import {
  NothingHeardError,
  TranscriptionTimeoutError,
  enqueueInstruction,
  fetchInstructLog,
  postInstructAction,
  type InstructVerb,
} from '../services/api';
import { NOTHING_HEARD, UPLOAD_FAILED } from '../utils/instruct';
import { useDailyPlansStore } from './useDailyPlansStore';
import { useGoalsStore } from './useGoalsStore';
import { useHabitsStore } from './useHabitsStore';
import { useJournalStore } from './useJournalStore';
import { useTodosStore } from './useTodosStore';

/** Local midnight as an ISO instant: the log is a today thing. */
function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

// An applied instruction changed real data; pull the app's stores back in line.
async function refreshData(): Promise<void> {
  try {
    await Promise.all([
      useHabitsStore.getState().loadHabits(),
      useGoalsStore.getState().loadGoals(),
      useTodosStore.getState().loadTodos(),
      useJournalStore.getState().loadEntries(),
      useDailyPlansStore.getState().loadPlan(getTodayDate()),
    ]);
  } catch (error) {
    console.warn('Failed to refresh data after instruction:', error);
  }
}

interface InstructLogState {
  /** Today's log, newest first — the pill, the sheet, and the hub count all read it. */
  actions: InstructActionRow[];
  /** Uploads still in flight: the pill shows "Sending…" before the row exists. */
  uploading: number;
  /** A transient client-side message (didn't catch that, upload failed). */
  notice: string | null;
  /** The action the next hold corrects; armed by Re-instruct, disarmed by tap or use. */
  reinstructOf: InstructActionRow | null;
  sheetOpen: boolean;
  /** Row actions in flight, so the sheet can show a spinner per row. */
  busy: Record<string, InstructVerb>;
  /**
   * Rows whose rewind/restore turn is still running server-side, keyed to the
   * status they must leave. Nothing is queued or working during that turn, so
   * this is what keeps the polling alive until the flip lands.
   */
  settling: Record<string, InstructActionRow['status']>;

  submit: (audioUri: string) => Promise<void>;
  refresh: () => Promise<void>;
  act: (id: string, verb: InstructVerb) => Promise<void>;
  armReinstruct: (action: InstructActionRow) => void;
  disarmReinstruct: () => void;
  clearNotice: () => void;
  setSheetOpen: (open: boolean) => void;
  clear: () => void;
}

function merge(actions: InstructActionRow[], row: InstructActionRow): InstructActionRow[] {
  const rest = actions.filter((action) => action.id !== row.id);
  return [row, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Did any row just land in a state that changed real data — applied, or rewound? */
function newlyLanded(previous: InstructActionRow[], next: InstructActionRow[]): boolean {
  const before = new Map(previous.map((action) => [action.id, action.status]));
  return next.some(
    (action) =>
      (action.status === 'applied' || action.status === 'rewound') &&
      before.has(action.id) &&
      before.get(action.id) !== action.status
  );
}

export const useInstructLogStore = create<InstructLogState>((set, get) => ({
  actions: [],
  uploading: 0,
  notice: null,
  reinstructOf: null,
  sheetOpen: false,
  busy: {},
  settling: {},

  submit: async (audioUri: string) => {
    const { reinstructOf } = get();
    set((state) => ({ uploading: state.uploading + 1, notice: null, reinstructOf: null }));
    try {
      const row = await enqueueInstruction({ audioUri, reinstructOf: reinstructOf?.id });
      set((state) => ({ actions: merge(state.actions, row) }));
    } catch (error) {
      if (error instanceof NothingHeardError) {
        set({ notice: NOTHING_HEARD });
        return;
      }
      console.warn('Instruction upload failed:', error);
      Sentry.captureException(error, { tags: { feature: 'instruct', stage: 'enqueue' } });
      set({ notice: error instanceof TranscriptionTimeoutError ? error.message : UPLOAD_FAILED });
    } finally {
      set((state) => ({ uploading: state.uploading - 1 }));
    }
  },

  refresh: async () => {
    try {
      const rows = await fetchInstructLog(startOfTodayIso());
      const previous = get().actions;
      const settling = { ...get().settling };
      for (const row of rows) {
        if (settling[row.id] && settling[row.id] !== row.status) delete settling[row.id];
      }
      set({ actions: rows, settling });
      if (newlyLanded(previous, rows)) void refreshData();
    } catch (error) {
      console.warn('Failed to refresh the activity log:', error);
    }
  },

  act: async (id: string, verb: InstructVerb) => {
    set((state) => ({ busy: { ...state.busy, [id]: verb } }));
    try {
      const row = await postInstructAction(id, verb);
      set((state) => ({
        actions: merge(state.actions, row),
        // A rewind/restore answers before its turn runs; poll until the status flips.
        ...(verb === 'rewind' || verb === 'restore'
          ? { settling: { ...state.settling, [id]: row.status } }
          : {}),
      }));
    } catch (error) {
      console.warn(`Instruct ${verb} failed:`, error);
      Sentry.captureException(error, { tags: { feature: 'instruct', stage: verb } });
    } finally {
      set((state) => {
        const busy = { ...state.busy };
        delete busy[id];
        return { busy };
      });
    }
  },

  armReinstruct: (action) => set({ reinstructOf: action, sheetOpen: false }),
  disarmReinstruct: () => set({ reinstructOf: null }),
  clearNotice: () => set({ notice: null }),
  setSheetOpen: (open) => set({ sheetOpen: open }),

  clear: () =>
    set({ actions: [], uploading: 0, notice: null, reinstructOf: null, sheetOpen: false, busy: {}, settling: {} }),
}));
