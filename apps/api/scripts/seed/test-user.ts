/**
 * Resolving the test account by email, shared by the seed and coach:smoke.
 *
 * The id is not hardcoded anywhere any more: on the shared project the account
 * keeps the id it has always had, and in a `--db` worktree it is created fresh
 * with a different one. Email is the only stable handle across both.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface TestUserEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  email: string;
  password: string;
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — add it to ${hint}`);
  return value;
}

/** Reads the four variables the seed needs, naming the missing one and where it lives. */
export function readTestUserEnv(): TestUserEnv {
  return {
    supabaseUrl: required('SUPABASE_URL', 'apps/api/.env'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', 'apps/api/.env'),
    email: required('TEST_USER_EMAIL', 'apps/api/.env'),
    password: required('TEST_USER_PASSWORD', 'apps/api/.env'),
  };
}

export function adminClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The auth user with this email, or null. The `auth` schema is not exposed
 * through PostgREST, so listing is the only lookup available — and this app has
 * one real user plus the test account, so one page covers it.
 */
async function findUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  const wanted = email.toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
  return match?.email ? { id: match.id, email: match.email } : null;
}

/**
 * The test account, with its password set to what the env says. Created if this
 * project has never seen it — which is what a fresh branch database always is.
 */
export async function upsertTestUser(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<{ id: string; email: string; created: boolean }> {
  const existing = await findUserByEmail(supabase, email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    return { ...existing, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user?.email) throw new Error('createUser returned no user');
  return { id: data.user.id, email: data.user.email, created: true };
}

/** The id coach:smoke and the seed both run as. */
export async function resolveTestUserId(): Promise<string> {
  const supabaseUrl = required('SUPABASE_URL', 'apps/api/.env');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY', 'apps/api/.env');
  const email = required('TEST_USER_EMAIL', 'apps/api/.env');
  const user = await findUserByEmail(adminClient(supabaseUrl, serviceRoleKey), email);
  if (!user) throw new Error(`No auth user with email ${email} — run 'pnpm seed' first`);
  return user.id;
}
