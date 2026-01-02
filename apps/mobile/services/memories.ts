import { supabase } from './supabase';
import type { Memory, MemoryCategory } from '@habits-coach/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

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

// Extract memories from a conversation (calls API)
export async function extractMemories(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/memories/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to extract memories');
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
