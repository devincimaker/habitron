import { supabase } from './supabase';
import type {
  CoachingSessionSummary,
  CoachingSessionDetail,
  CoachTurnRecord,
  RitualId,
  UpdateSessionRequest,
} from '@habits-coach/shared';
import { handleFetchError } from './fetchErrorHandler';
import { createApiUrl } from './apiUrl';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function getSessions(): Promise<CoachingSessionSummary[]> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/sessions'), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch sessions');
  }

  const data = await response.json();
  return data.sessions;
}

export async function getSession(id: string): Promise<CoachingSessionDetail> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${id}`), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch session');
  }

  const data = await response.json();
  return data.session;
}

/** Where the session's last coach turn stands; null before its first turn. */
export async function getSessionTurn(id: string): Promise<CoachTurnRecord | null> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${id}/turn`), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch the turn');
  }

  const data = await response.json();
  return data.turn;
}

/**
 * Creates a session, or — for a ritual — returns the day's existing one. The
 * backend does the finding, so a double tap cannot open two.
 */
/** Opening a ritual: which practice, and the day it is for. */
export interface RitualStart {
  opener: RitualId;
  ritualDate: string;
}

export async function createSession(ritual?: RitualStart): Promise<CoachingSessionDetail> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(ritual ?? {}),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to create session');
  }

  const data = await response.json();
  return data.session;
}

export async function updateSession(
  id: string,
  updates: UpdateSessionRequest
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to update session');
  }
}

export async function finalizeSession(
  id: string,
  options?: { generateSummary?: boolean; extractMemories?: boolean }
): Promise<{ success: boolean; name: string }> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${id}/finalize`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to finalize session');
  }

  return response.json();
}

export async function deleteSession(id: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to delete session');
  }
}
