import type { CoachingSessionSummary, Memory } from '@habits-coach/shared';

jest.mock('../services/memories', () => ({
  getMemories: jest.fn(),
  extractMemories: jest.fn(),
  saveMemories: jest.fn(),
  updateMemory: jest.fn(),
  deleteMemory: jest.fn(),
}));

jest.mock('../services/sessions', () => ({
  getSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

import * as memoriesService from '../services/memories';
import * as sessionsService from '../services/sessions';
import { useMemoriesStore } from '../stores/useMemoriesStore';
import { useSessionsStore } from '../stores/useSessionsStore';

const memory = { id: 'memory-1', content: 'Prefers mornings', category: 'preference' } as Memory;
const session = { id: 'session-1', name: 'Monday' } as CoachingSessionSummary;

describe('useMemoriesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    useMemoriesStore.setState({ memories: [memory], isLoading: false });
  });

  it('edits at once and restores the memory on failure', async () => {
    (memoriesService.updateMemory as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useMemoriesStore.getState().updateMemory(memory.id, { content: 'Prefers evenings' });
    expect(useMemoriesStore.getState().memories[0]).toMatchObject({ content: 'Prefers evenings' });

    await expect(pending).rejects.toThrow('offline');
    expect(useMemoriesStore.getState().memories).toEqual([memory]);
  });

  it('deletes at once and brings the memory back on failure', async () => {
    (memoriesService.deleteMemory as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useMemoriesStore.getState().deleteMemory(memory.id);
    expect(useMemoriesStore.getState().memories).toEqual([]);

    await expect(pending).rejects.toThrow('offline');
    expect(useMemoriesStore.getState().memories).toEqual([memory]);
  });
});

describe('useSessionsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useSessionsStore.setState({ sessions: [session], isLoading: false, hasLoaded: true });
  });

  it('deletes at once and brings the session back on failure', async () => {
    (sessionsService.deleteSession as jest.Mock).mockRejectedValue(new Error('offline'));

    const pending = useSessionsStore.getState().deleteSession(session.id);
    expect(useSessionsStore.getState().sessions).toEqual([]);

    await expect(pending).rejects.toThrow('offline');
    expect(useSessionsStore.getState().sessions).toEqual([session]);
  });
});
