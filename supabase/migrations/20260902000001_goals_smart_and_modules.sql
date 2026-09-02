-- Goals become real (HAB-126). A goal is an outcome that ends: what it is,
-- how you will know it is done, and by when. Open or done is read from
-- completed_at; reviewed_at is what the goals review stamps. status, priority
-- and description go (AGENTS.md §1: the minimum that makes the feature work).
--
-- Nothing in the app or the coach has ever been able to create a goal, so the
-- table is expected to be empty. The two backfill lines only matter if a row
-- was ever inserted by hand.

DROP INDEX IF EXISTS idx_goals_status;

ALTER TABLE goals
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS description;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS measure TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE goals ALTER COLUMN measure DROP DEFAULT;

UPDATE goals SET target_date = CURRENT_DATE WHERE target_date IS NULL;
ALTER TABLE goals ALTER COLUMN target_date SET NOT NULL;

-- Modules: a feature the app runs without. Off hides its screens and takes it
-- out of the coach's context; the rows stay. Goals is the first entry; a
-- module joins the check when someone builds its off state.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS disabled_modules TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_disabled_modules_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_disabled_modules_check
  CHECK (disabled_modules <@ ARRAY['goals']::TEXT[]);
