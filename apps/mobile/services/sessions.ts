import { supabase } from './supabase';
import type {
  CoachSkillId,
  CoachDebugEventInput,
  CoachDebugEvent,
  CoachingSessionSummary,
  CoachingSessionDetail,
  CoachingSessionMessage,
  UpdateSessionSkillRequest,
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

export async function getActiveSession(): Promise<{
  id: string;
  name?: string | null;
  startedAt: number;
  messages: CoachingSessionMessage[];
  updatedAt: number;
  leadSkillId?: CoachSkillId | null;
} | null> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/sessions/active'), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch active session');
  }

  const data = await response.json();
  return data.session;
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

export async function createSession(): Promise<{ id: string; startedAt: number }> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl('/api/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to create session');
  }

  const data = await response.json();
  return data.session;
}

export async function updateSession(
  id: string,
  updates: {
    messages?: CoachingSessionMessage[];
    name?: string;
    endedAt?: number;
  }
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
): Promise<{ name: string; memoryExtractionStatus?: string }> {
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

export async function updateSessionSkill(
  sessionId: string,
  skillId: CoachSkillId,
  updates: UpdateSessionSkillRequest
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${sessionId}/skills/${skillId}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to update session skill');
  }
}

export async function createSessionDebugEvent(
  sessionId: string,
  event: CoachDebugEventInput
): Promise<CoachDebugEvent> {
  const token = await getAuthToken();

  const response = await fetch(createApiUrl(`/api/sessions/${sessionId}/debug-events`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ event }),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to create session debug event');
  }

  const data = await response.json();
  return data.event;
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
