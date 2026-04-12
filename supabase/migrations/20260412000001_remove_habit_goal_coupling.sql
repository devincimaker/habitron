DROP INDEX IF EXISTS idx_habits_goal_id;

ALTER TABLE habits
  DROP COLUMN IF EXISTS goal_id;
