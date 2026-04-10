-- Add soft-archive support for habits.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, active);
