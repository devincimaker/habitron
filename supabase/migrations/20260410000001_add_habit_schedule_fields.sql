ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS weekly_days TEXT[],
  ADD COLUMN IF NOT EXISTS weekly_count INTEGER;

UPDATE habits
SET weekly_count = 1
WHERE frequency = 'weekly' AND weekly_count IS NULL;

ALTER TABLE habits
  DROP CONSTRAINT IF EXISTS habits_weekly_days_check;

ALTER TABLE habits
  ADD CONSTRAINT habits_weekly_days_check
  CHECK (
    weekly_days IS NULL
    OR (
      cardinality(weekly_days) BETWEEN 1 AND 7
      AND weekly_days <@ ARRAY['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']::TEXT[]
    )
  );

ALTER TABLE habits
  DROP CONSTRAINT IF EXISTS habits_weekly_count_check;

ALTER TABLE habits
  ADD CONSTRAINT habits_weekly_count_check
  CHECK (
    weekly_count IS NULL
    OR weekly_count BETWEEN 1 AND 7
  );
