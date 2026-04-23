-- Coach Session Debug Events
-- Stores append-only per-turn debugging telemetry for coaching sessions

CREATE TABLE IF NOT EXISTS coaching_session_debug_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_index INTEGER,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'chat_request_sent',
      'chat_response_received',
      'chat_response_rejected',
      'proposal_received',
      'proposal_apply_started',
      'proposal_apply_succeeded',
      'proposal_apply_failed',
      'session_sync_failed'
    )
  ),
  request_payload JSONB,
  response_payload JSONB,
  proposal_payload JSONB,
  error_message TEXT,
  error_code TEXT,
  error_stage TEXT CHECK (
    error_stage IS NULL OR error_stage IN (
      'chat_generation',
      'chat_response_parse',
      'chat_response_validation',
      'proposal_validation',
      'proposal_apply',
      'session_sync',
      'session_finalize',
      'unknown'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_debug_events_session_id
  ON coaching_session_debug_events(session_id);
CREATE INDEX IF NOT EXISTS idx_coach_debug_events_user_id
  ON coaching_session_debug_events(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_debug_events_session_created_at
  ON coaching_session_debug_events(session_id, created_at ASC);

ALTER TABLE coaching_session_debug_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coach debug events" ON coaching_session_debug_events;
CREATE POLICY "Users can view own coach debug events"
  ON coaching_session_debug_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own coach debug events" ON coaching_session_debug_events;
CREATE POLICY "Users can insert own coach debug events"
  ON coaching_session_debug_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
