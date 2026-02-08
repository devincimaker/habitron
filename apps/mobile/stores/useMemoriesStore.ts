import { create } from 'zustand';
import type { Memory, MemoryCategory } from '@habits-coach/shared';
import * as memoriesService from '../services/memories';
import type { ExtractedMemory } from '../services/memories';
import { handleStoreAction } from './storeUtils';

interface MemoriesState {
  memories: Memory[];
  isLoading: boolean;

  // Actions
  loadMemories: () => Promise<void>;
  extractMemories: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<ExtractedMemory[]>;
  saveMemories: (memories: ExtractedMemory[], sessionId?: string) => Promise<void>;
  updateMemory: (
    id: string,
    updates: { content?: string; category?: MemoryCategory }
  ) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearMemories: () => void;
}

export type { ExtractedMemory };

export const useMemoriesStore = create<MemoriesState>((set, get) => ({
  memories: [],
  isLoading: false,

  loadMemories: async () => {
    await handleStoreAction({
      action: async () => await memoriesService.getMemories(),
      onSuccess: (memories) => set({ memories }),
      context: 'load memories',
      setState: (state) => set(state),
    });
  },

  extractMemories: async (messages) => {
    try {
      const extracted = await memoriesService.extractMemories(messages);
      return extracted;
    } catch (error) {
      console.error('Failed to extract memories:', error);
      return [];
    }
  },

  saveMemories: async (memories, sessionId) => {
    try {
      await memoriesService.saveMemories(memories, sessionId);
      // Reload memories after saving to get the complete list
      await get().loadMemories();
    } catch (error) {
      console.error('Failed to save memories:', error);
      throw error;
    }
  },

  updateMemory: async (id, updates) => {
    await handleStoreAction({
      action: async () => await memoriesService.updateMemory(id, updates),
      onSuccess: () => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m
          ),
        }));
      },
      context: 'update memory',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  deleteMemory: async (id) => {
    await handleStoreAction({
      action: async () => await memoriesService.deleteMemory(id),
      onSuccess: () => {
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        }));
      },
      context: 'delete memory',
      setLoading: false,
      rethrow: true,
      setState: () => {},
    });
  },

  clearMemories: () => {
    set({ memories: [] });
  },
}));
