import { supabase } from './supabase';
import type { Memory, MemoryCategory, ExtractMemoriesResponse } from '@habits-coach/shared';
import { handleFetchError } from './fetchErrorHandler';
import { createApiUrl } from './apiUrl';

// Type for extracted memory before saving (no id yet)
export interface ExtractedMemory {
  content: string;
  category: MemoryCategory;
}

// Database row type (snake_case from Supabase)
interface DbMemory {
  id: string;
  user_id: string;
  content: string;
  category: MemoryCategory;
  source_session_at: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database row to app type
function mapDbMemoryToMemory(dbMemory: DbMemory): Memory {
  return {
    id: dbMemory.id,
    content: dbMemory.content,
    category: dbMemory.category,
    sourceSessionAt: dbMemory.source_session_at
      ? new Date(dbMemory.source_session_at).getTime()
      : undefined,
    createdAt: new Date(dbMemory.created_at).getTime(),
    updatedAt: new Date(dbMemory.updated_at).getTime(),
  };
}

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return session.access_token;
}

// Get all memories for the current user
export async function getMemories(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching memories:', error);
    throw error;
  }

  return (data as DbMemory[]).map(mapDbMemoryToMemory);
}

// Extract memories from a conversation (calls API, returns without saving)
export async function extractMemories(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ExtractedMemory[]> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/memories/extract'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to extract memories');
  }

  const data = (await response.json()) as ExtractMemoriesResponse;
  return data.memories;
}

// Save approved memories to database
export async function saveMemories(
  memories: ExtractedMemory[],
  sessionId?: string
): Promise<void> {
  if (memories.length === 0) return;

  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/memories'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ memories, sessionId }),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to save memories');
  }
}

// Update a memory
export async function updateMemory(
  id: string,
  updates: { content?: string; category?: MemoryCategory }
): Promise<void> {
  const { error } = await supabase.from('memories').update(updates).eq('id', id);

  if (error) {
    console.error('Error updating memory:', error);
    throw error;
  }
}

// Delete a memory
export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('memories').delete().eq('id', id);

  if (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
}
