export const CONFIG = {
  // Session timeout in milliseconds (30 minutes)
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,

  // API configuration
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',

  // Supabase configuration
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
} as const;
