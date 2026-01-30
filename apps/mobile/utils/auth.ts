import { supabase } from '../services/supabase';

/**
 * Gets the current user's authentication token from Supabase session.
 * @throws {Error} If user is not authenticated
 * @returns {Promise<string>} The user's access token
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
