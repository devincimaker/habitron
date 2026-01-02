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

/**
 * Notify the backend when a user skips a habit.
 * This is used to detect first-ever skip and schedule a notification.
 * Fire-and-forget - errors are logged but not thrown.
 */
export async function notifyFirstSkip(habitId: string): Promise<void> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/api/notifications/first-skip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ habitId }),
    });

    if (!response.ok) {
      console.error('Failed to notify first skip:', response.status);
    }
  } catch (error) {
    // Fire and forget - don't throw, just log
    console.error('Error notifying first skip:', error);
  }
}
