import { vi } from 'vitest';

// Mock environment variables
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-oauth-token';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
