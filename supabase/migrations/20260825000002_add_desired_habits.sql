-- Desired habits: habits already decided on but not started, waiting on capacity.
-- A north star for direction, not a queue to drain.

CREATE TABLE IF NOT EXISTS desired_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  -- The habit standing in for it, if any. NULL means nothing has been started.
  -- ON DELETE SET NULL is deliberate: deleting the stand-in habit puts the
  -- desired habit back to not-started, because the intention outlives the attempt.
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desired_habits_user_id ON desired_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_desired_habits_habit_id ON desired_habits(habit_id);

DROP TRIGGER IF EXISTS update_desired_habits_updated_at ON desired_habits;
CREATE TRIGGER update_desired_habits_updated_at
  BEFORE UPDATE ON desired_habits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE desired_habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own desired habits" ON desired_habits;
CREATE POLICY "Users can manage own desired habits" ON desired_habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
