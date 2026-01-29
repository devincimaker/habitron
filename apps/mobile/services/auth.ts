import { supabase } from './supabase';

/**
 * Retrieves the current user's authentication token from Supabase session.
 *
 * @returns The access token for authenticated API requests
 * @throws {Error} If user is not authenticated or session is invalid
 */
export async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return session.access_token;
}
