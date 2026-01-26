import { supabase } from './supabase';

/**
 * Get the current user's authentication token
 * @throws {Error} if the user is not authenticated
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
