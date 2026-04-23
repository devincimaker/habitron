-- Session skill state

CREATE TABLE IF NOT EXISTS coaching_skill_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  phase TEXT,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coaching_skill_instances_status_check
    CHECK (status IN ('active', 'paused', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_skill_instances_session_skill
  ON coaching_skill_instances(session_id, skill_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_skill_instances_single_lead
  ON coaching_skill_instances(session_id)
  WHERE is_lead = TRUE AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_coaching_skill_instances_user_id
  ON coaching_skill_instances(user_id);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_instances_session_id
  ON coaching_skill_instances(session_id);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_instances_last_used_at
  ON coaching_skill_instances(last_used_at DESC);

DROP TRIGGER IF EXISTS update_coaching_skill_instances_updated_at ON coaching_skill_instances;
CREATE TRIGGER update_coaching_skill_instances_updated_at
  BEFORE UPDATE ON coaching_skill_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE coaching_skill_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coaching skill instances" ON coaching_skill_instances;
CREATE POLICY "Users can view own coaching skill instances"
  ON coaching_skill_instances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own coaching skill instances" ON coaching_skill_instances;
CREATE POLICY "Users can insert own coaching skill instances"
  ON coaching_skill_instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own coaching skill instances" ON coaching_skill_instances;
CREATE POLICY "Users can update own coaching skill instances"
  ON coaching_skill_instances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own coaching skill instances" ON coaching_skill_instances;
CREATE POLICY "Users can delete own coaching skill instances"
  ON coaching_skill_instances FOR DELETE
  USING (auth.uid() = user_id);
