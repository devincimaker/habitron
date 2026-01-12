import { create } from 'zustand';
import type { Memory, MemoryCategory } from '@habits-coach/shared';
import * as memoriesService from '../services/memories';
import type { ExtractedMemory } from '../services/memories';

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
    set({ isLoading: true });
    try {
      const memories = await memoriesService.getMemories();
      set({ memories, isLoading: false });
    } catch (error) {
      console.error('Failed to load memories:', error);
      set({ isLoading: false });
    }
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
    try {
      await memoriesService.updateMemory(id, updates);
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to update memory:', error);
      throw error;
    }
  },

  deleteMemory: async (id) => {
    try {
      await memoriesService.deleteMemory(id);
      set((state) => ({
        memories: state.memories.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw error;
    }
  },

  clearMemories: () => {
    set({ memories: [] });
  },
}));
