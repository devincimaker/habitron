import type {
  CoachingSessionSummary,
  CoachingSessionDetail,
  CoachingSessionMessage,
} from '@habits-coach/shared';
import { handleFetchError } from './fetchErrorHandler';
import { getAuthToken } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export async function getSessions(): Promise<CoachingSessionSummary[]> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/sessions`, {
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
  startedAt: number;
  messages: CoachingSessionMessage[];
  updatedAt: number;
} | null> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/sessions/active`, {
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

  const response = await fetch(`${API_URL}/api/sessions/${id}`, {
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

  const response = await fetch(`${API_URL}/api/sessions`, {
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

  const response = await fetch(`${API_URL}/api/sessions/${id}`, {
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
): Promise<{ name: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/sessions/${id}/finalize`, {
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

  const response = await fetch(`${API_URL}/api/sessions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to delete session');
  }
}
