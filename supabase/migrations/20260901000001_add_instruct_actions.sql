-- Instruct actions: the fire-and-forget queue behind hold-to-instruct (HAB-134).
--
-- One row per spoken instruction. The client's only write path is the API
-- (service role): it enqueues, a sequential per-user worker runs one
-- write-capable agent turn, and the row is the record the app re-derives all
-- UI from — the ticker pill, the Coach activity sheet, the hub count.
--
-- `tool_calls` records every write-tool call the turn made (name + args); it
-- is the undo source a rewind turn replays in reverse. Display state is
-- derived from `status` + timestamps, nothing more.

CREATE TABLE IF NOT EXISTS instruct_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'working', 'applied', 'failed', 'rewound', 'canceled')),
  -- What the user said, verbatim from Whisper.
  transcript        TEXT NOT NULL,
  -- IANA timezone at enqueue time: the turn may run after the client is gone
  -- (boot-resume included), so "today" has to be resolvable from the row alone.
  timezone          TEXT NOT NULL,
  -- The working label ("Moving 'Gym' to 6:00 PM…"), streamed early in the turn.
  summary           TEXT,
  -- The done label ("Moved 'Gym' to 6:00 PM"), or what a rewind could not restore.
  result            TEXT,
  -- Why the turn failed: an error, or the coach's question when it would not guess.
  error             TEXT,
  -- Recorded write-tool calls [{name, args}] — the rewind's undo source.
  tool_calls        JSONB,
  claude_session_id TEXT,
  -- The applied/failed action this one corrects (Re-instruct); the correction
  -- turn quotes that row's transcript and result as context.
  reinstruct_of     UUID REFERENCES instruct_actions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_instruct_actions_user_created
  ON instruct_actions(user_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE instruct_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own instruct actions" ON instruct_actions;
CREATE POLICY "Users can view own instruct actions"
  ON instruct_actions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own instruct actions" ON instruct_actions;
CREATE POLICY "Users can insert own instruct actions"
  ON instruct_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own instruct actions" ON instruct_actions;
CREATE POLICY "Users can update own instruct actions"
  ON instruct_actions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own instruct actions" ON instruct_actions;
CREATE POLICY "Users can delete own instruct actions"
  ON instruct_actions FOR DELETE
  USING (auth.uid() = user_id);
