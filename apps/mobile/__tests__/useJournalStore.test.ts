import type { JournalEntry } from '@habits-coach/shared';

jest.mock('../services/journal', () => ({
  getJournalEntries: jest.fn(),
  addJournalEntry: jest.fn(),
  updateJournalEntry: jest.fn(),
  deleteJournalEntry: jest.fn(),
}));

import * as journalService from '../services/journal';
import { useJournalStore } from '../stores/useJournalStore';

const existing: JournalEntry = {
  id: 'entry-1',
  entryDate: '2026-09-01',
  content: 'Slept well.',
  source: 'manual',
  createdAt: 1,
  updatedAt: 1,
};

describe('useJournalStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useJournalStore.setState({ entries: [existing], isLoading: false });
  });

  it('shows a new entry first and swaps in the server row', async () => {
    let settle: (entry: JournalEntry) => void = () => undefined;
    (journalService.addJournalEntry as jest.Mock).mockImplementation(
      () => new Promise<JournalEntry>((resolve) => { settle = resolve; })
    );

    const pending = useJournalStore.getState().addEntry({ content: 'Long walk.', mood: 'good' });

    expect(useJournalStore.getState().entries[0]).toMatchObject({
      content: 'Long walk.',
      mood: 'good',
      source: 'manual',
    });
    expect(useJournalStore.getState().entries).toHaveLength(2);

    const created: JournalEntry = { ...existing, id: 'entry-2', content: 'Long walk.', mood: 'good', createdAt: 2, updatedAt: 2 };
    settle(created);
    await expect(pending).resolves.toEqual(created);
    expect(useJournalStore.getState().entries).toEqual([created, existing]);
  });

  it('drops a new entry when the write fails', async () => {
    (journalService.addJournalEntry as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(useJournalStore.getState().addEntry({ content: 'Long walk.' })).rejects.toThrow('offline');

    expect(useJournalStore.getState().entries).toEqual([existing]);
  });

  it('edits at once and restores the old entry on failure', async () => {
    (journalService.updateJournalEntry as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useJournalStore.getState().updateEntry(existing.id, { content: 'Slept badly.' });
    expect(useJournalStore.getState().entries[0]).toMatchObject({ content: 'Slept badly.' });

    await expect(pending).rejects.toThrow('offline');
    expect(useJournalStore.getState().entries).toEqual([existing]);
  });

  it('removes at once and brings the entry back on failure', async () => {
    (journalService.deleteJournalEntry as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useJournalStore.getState().removeEntry(existing.id);
    expect(useJournalStore.getState().entries).toEqual([]);

    await expect(pending).rejects.toThrow('offline');
    expect(useJournalStore.getState().entries).toEqual([existing]);
  });
});
