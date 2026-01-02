import { supabase } from './supabase';
import type { ChatRequest, ChatResponse, Habit, Memory } from '@habits-coach/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError('Not authenticated', 401);
  }

  return session.access_token;
}

export async function sendMessage(
  messages: ChatRequest['messages'],
  habits: Habit[],
  memories?: Memory[]
): Promise<ChatResponse> {
  const token = await getAuthToken();

  // Map habits to the request format
  const habitData: ChatRequest['habits'] = habits.map((h) => ({
    id: h.id,
    name: h.name,
    frequency: h.frequency,
    timeOfDay: h.timeOfDay,
    reason: h.reason,
  }));

  // Map memories to the request format
  const memoriesData: ChatRequest['memories'] = memories?.map((m) => ({
    content: m.content,
    category: m.category,
  }));

  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      habits: habitData,
      memories: memoriesData,
    } satisfies ChatRequest),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.error || 'Failed to send message',
      response.status
    );
  }

  return response.json();
}
