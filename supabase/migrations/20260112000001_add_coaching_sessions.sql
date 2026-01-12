-- Coaching Sessions Feature Migration
-- Stores session metadata, chat history, and links memories to sessions

-- ============================================
-- TABLES
-- ============================================

-- Coaching sessions table
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,  -- AI-generated summary, null until processed
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of {role, content, timestamp}
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,  -- Null while session is active
  is_processed BOOLEAN NOT NULL DEFAULT FALSE,  -- True after summary/memories extracted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add session_id to memories table
ALTER TABLE memories
  ADD COLUMN session_id UUID REFERENCES coaching_sessions(id) ON DELETE CASCADE;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_id ON coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_started_at ON coaching_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_is_processed ON coaching_sessions(is_processed) WHERE is_processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to coaching_sessions
DROP TRIGGER IF EXISTS update_coaching_sessions_updated_at ON coaching_sessions;
CREATE TRIGGER update_coaching_sessions_updated_at
  BEFORE UPDATE ON coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Coaching sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON coaching_sessions;
CREATE POLICY "Users can view own sessions"
  ON coaching_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON coaching_sessions;
CREATE POLICY "Users can insert own sessions"
  ON coaching_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON coaching_sessions;
CREATE POLICY "Users can update own sessions"
  ON coaching_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON coaching_sessions;
CREATE POLICY "Users can delete own sessions"
  ON coaching_sessions FOR DELETE
  USING (auth.uid() = user_id);
