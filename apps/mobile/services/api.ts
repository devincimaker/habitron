import { supabase } from './supabase';
import type { ChatRequest, ChatResponse } from '@habits-coach/shared';
import { createApiUrl } from './apiUrl';

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

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
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

export async function transcribeAudio(audioUri: string): Promise<string> {
  const token = await getAuthToken();

  // Create form data with the audio file
  const formData = new FormData();

  // Get the file extension from URI and determine mime type
  const extension = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeTypeMap: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/x-m4a',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
  };
  const mimeType = mimeTypeMap[extension] || 'audio/x-m4a';

  formData.append('audio', {
    uri: audioUri,
    type: mimeType,
    name: `recording.${extension}`,
  } as unknown as Blob);

  const response = await fetch(createApiUrl('/api/transcribe'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to transcribe audio');
  }

  const data = await response.json();
  return data.text;
}

/**
 * Notify the backend when a user skips a habit.
 * This is used to detect first-ever skip and schedule a notification.
 * Fire-and-forget - errors are logged but not thrown.
 */
export async function notifyFirstSkip(habitId: string): Promise<void> {
  try {
    const token = await getAuthToken();

    const response = await fetch(createApiUrl('/api/notifications/first-skip'), {
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
