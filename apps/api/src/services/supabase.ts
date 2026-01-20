import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Centralized Supabase client instance.
 * Can be overridden for testing via setSupabaseClient().
 */
let supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

/**
 * Get the current Supabase client instance.
 * Use this in all routes and services instead of creating new clients.
 */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

/**
 * Set a custom Supabase client (for testing).
 */
export function setSupabaseClient(client: SupabaseClient): void {
  supabase = client;
}
