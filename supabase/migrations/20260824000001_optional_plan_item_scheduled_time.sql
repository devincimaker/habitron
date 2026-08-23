-- Plan items are ordered by `position`. A time is only meaningful for real
-- appointments, so allow it to be null.

ALTER TABLE daily_plan_items
  ALTER COLUMN scheduled_time DROP NOT NULL;

ALTER TABLE daily_plan_items
  DROP CONSTRAINT IF EXISTS daily_plan_items_scheduled_time_check;

ALTER TABLE daily_plan_items
  ADD CONSTRAINT daily_plan_items_scheduled_time_check
  CHECK (
    scheduled_time IS NULL
    OR scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
