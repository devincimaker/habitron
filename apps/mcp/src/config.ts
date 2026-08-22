import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load apps/mcp/.env regardless of the cwd the MCP host launched us from.
loadDotenv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },
  userId: required('HABITRON_USER_ID'),
  timezone:
    process.env.HABITRON_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
} as const;
