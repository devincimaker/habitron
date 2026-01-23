import { supabase } from './supabase';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Gets the current user's authentication token.
 * @throws {AuthError} If the user is not authenticated (status 401)
 */
export async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AuthError('Not authenticated', 401);
  }

  return session.access_token;
}
