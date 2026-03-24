import { create } from 'zustand';
import type { JournalEntry, JournalEntryDraft } from '@habits-coach/shared';
import * as journalService from '../services/journal';

interface JournalState {
  entries: JournalEntry[];
  isLoading: boolean;
  loadEntries: (limit?: number) => Promise<void>;
  addEntry: (entry: JournalEntryDraft) => Promise<JournalEntry>;
  updateEntry: (entryId: string, changes: Partial<JournalEntryDraft>) => Promise<JournalEntry>;
  removeEntry: (entryId: string) => Promise<void>;
  getEntriesForDate: (date: string) => JournalEntry[];
  getLatestEntryForDate: (date: string) => JournalEntry | null;
  getRecentTags: (limit?: number) => string[];
  clearEntries: () => void;
}

function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
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
    const createdEntry = await journalService.addJournalEntry(entry);
    set((state) => ({
      entries: sortEntries([createdEntry, ...state.entries]),
    }));
    return createdEntry;
  },

  updateEntry: async (entryId, changes) => {
    const updatedEntry = await journalService.updateJournalEntry(entryId, changes);
    set((state) => ({
      entries: sortEntries(
        state.entries.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      ),
    }));
    return updatedEntry;
  },

  removeEntry: async (entryId) => {
    await journalService.deleteJournalEntry(entryId);
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== entryId),
    }));
  },

  getEntriesForDate: (date) => {
    return get().entries.filter((entry) => entry.entryDate === date);
  },

  getLatestEntryForDate: (date) => {
    return get().entries.find((entry) => entry.entryDate === date) ?? null;
  },

  getRecentTags: (limit = 8) => {
    const counts = new Map<string, number>();

    for (const entry of get().entries) {
      for (const tag of entry.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([tag]) => tag);
  },

  clearEntries: () => {
    set({ entries: [], isLoading: false });
  },
}));
