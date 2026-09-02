import { create } from 'zustand';
import type { JournalEntry, JournalEntryDraft } from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';
import * as journalService from '../services/journal';

interface JournalState {
  entries: JournalEntry[];
  isLoading: boolean;
  loadEntries: (limit?: number) => Promise<void>;
  /** Optimistic: the entry shows at once; the promise resolves with the server row. */
  addEntry: (entry: JournalEntryDraft) => Promise<JournalEntry>;
  updateEntry: (entryId: string, changes: Partial<JournalEntryDraft>) => Promise<JournalEntry>;
  removeEntry: (entryId: string) => Promise<void>;
  getEntriesForDate: (date: string) => JournalEntry[];
  getLatestEntryForDate: (date: string) => JournalEntry | null;
  clearEntries: () => void;
}

function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

function replaceEntry(entries: JournalEntry[], entryId: string, next: JournalEntry) {
  return sortEntries(entries.map((entry) => (entry.id === entryId ? next : entry)));
}

/** Mirrors the service's defaults: today, manual. */
function buildOptimisticEntry(draft: JournalEntryDraft): JournalEntry {
  const now = Date.now();
  return {
    id: `optimistic-entry-${now}-${Math.random().toString(36).slice(2, 8)}`,
    entryDate: draft.entryDate ?? getTodayDate(),
    content: draft.content,
    mood: draft.mood,
    source: draft.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  isLoading: false,

  loadEntries: async (limit = 50) => {
    set({ isLoading: true });
    try {
      const entries = await journalService.getJournalEntries(limit);
      set({ entries: sortEntries(entries), isLoading: false });
    } catch (error) {
      console.error('Failed to load journal entries:', error);
      set({ isLoading: false });
    }
  },

  addEntry: async (entry) => {
    const optimistic = buildOptimisticEntry(entry);
    set((state) => ({ entries: sortEntries([optimistic, ...state.entries]) }));

    try {
      const createdEntry = await journalService.addJournalEntry(entry);
      set((state) => ({ entries: replaceEntry(state.entries, optimistic.id, createdEntry) }));
      return createdEntry;
    } catch (error) {
      set((state) => ({ entries: state.entries.filter((item) => item.id !== optimistic.id) }));
      throw error;
    }
  },

  updateEntry: async (entryId, changes) => {
    const current = get().entries.find((entry) => entry.id === entryId);
    if (current) {
      set((state) => ({
        entries: replaceEntry(state.entries, entryId, {
          ...current,
          ...changes,
          updatedAt: Date.now(),
        }),
      }));
    }

    try {
      const updatedEntry = await journalService.updateJournalEntry(entryId, changes);
      set((state) => ({ entries: replaceEntry(state.entries, entryId, updatedEntry) }));
      return updatedEntry;
    } catch (error) {
      if (current) {
        set((state) => ({ entries: replaceEntry(state.entries, entryId, current) }));
      }
      throw error;
    }
  },

  removeEntry: async (entryId) => {
    const { entries } = get();
    set({ entries: entries.filter((entry) => entry.id !== entryId) });

    try {
      await journalService.deleteJournalEntry(entryId);
    } catch (error) {
      set({ entries });
      throw error;
    }
  },

  getEntriesForDate: (date) => {
    return get().entries.filter((entry) => entry.entryDate === date);
  },

  getLatestEntryForDate: (date) => {
    return get().entries.find((entry) => entry.entryDate === date) ?? null;
  },

  clearEntries: () => {
    set({ entries: [], isLoading: false });
  },
}));
