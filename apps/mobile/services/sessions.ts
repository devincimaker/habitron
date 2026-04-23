import type {
  ActiveSession,
  CoachDebugEvent,
  CoachingSessionSummary,
  CoachingSessionDetail,
  CreateCoachDebugEventRequest,
  CreateCoachDebugEventResponse,
  CreateSessionResponse,
  FinalizeSessionRequest,
  FinalizeSessionResponse,
  GetCoachDebugEventsResponse,
  GetActiveSessionResponse,
  GetSessionResponse,
  GetSessionsResponse,
  UpdateSessionRequest,
} from '@habits-coach/shared';
import { handleFetchError } from './fetchErrorHandler';
import { fetchApi } from './apiClient';

export async function getSessions(): Promise<CoachingSessionSummary[]> {
  const response = await fetchApi('/api/sessions');

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch sessions');
  }

  const data = (await response.json()) as GetSessionsResponse;
  return data.sessions;
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const response = await fetchApi('/api/sessions/active');

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch active session');
  }

  const data = (await response.json()) as GetActiveSessionResponse;
  return data.session;
}

export async function getSession(id: string): Promise<CoachingSessionDetail> {
  const response = await fetchApi(`/api/sessions/${id}`);

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch session');
  }

  const data = (await response.json()) as GetSessionResponse;
  return data.session;
}

export async function createSession(): Promise<CreateSessionResponse['session']> {
  const response = await fetchApi('/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to create session');
  }

  const data = (await response.json()) as CreateSessionResponse;
  return data.session;
}

export async function updateSession(
  id: string,
  updates: UpdateSessionRequest
): Promise<void> {
  const response = await fetchApi(`/api/sessions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to update session');
  }
}

export async function finalizeSession(
  id: string,
  options?: FinalizeSessionRequest
): Promise<FinalizeSessionResponse> {
  const response = await fetchApi(`/api/sessions/${id}/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to finalize session');
  }

  return (await response.json()) as FinalizeSessionResponse;
}

export async function deleteSession(id: string): Promise<void> {
  const response = await fetchApi(`/api/sessions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to delete session');
  }
}

export async function getSessionDebugEvents(id: string): Promise<CoachDebugEvent[]> {
  const response = await fetchApi(`/api/sessions/${id}/debug-events`);

  if (!response.ok) {
    await handleFetchError(response, 'Failed to fetch session debug events');
  }

  const data = (await response.json()) as GetCoachDebugEventsResponse;
  return data.events;
}

export async function createSessionDebugEvent(
  id: string,
  event: CreateCoachDebugEventRequest['event']
): Promise<CreateCoachDebugEventResponse['event']> {
  const response = await fetchApi(`/api/sessions/${id}/debug-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event } satisfies CreateCoachDebugEventRequest),
  });

  if (!response.ok) {
    await handleFetchError(response, 'Failed to create session debug event');
  }

  const data = (await response.json()) as CreateCoachDebugEventResponse;
  return data.event;
}
