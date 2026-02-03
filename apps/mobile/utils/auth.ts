import { supabase } from '../services/supabase';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get the current user's authentication token.
 * @throws {ApiError} If the user is not authenticated (401)
 */
export async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError('Not authenticated', 401);
  }

  return session.access_token;
}
