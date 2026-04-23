ALTER TABLE daily_plan_items
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

UPDATE daily_plan_items
SET scheduled_time = CASE scheduled_block
  WHEN 'morning' THEN '09:00'
  WHEN 'afternoon' THEN '13:00'
  WHEN 'evening' THEN '18:00'
  ELSE '09:00'
END
WHERE scheduled_time IS NULL;

ALTER TABLE daily_plan_items
  DROP CONSTRAINT IF EXISTS daily_plan_items_scheduled_time_check;

ALTER TABLE daily_plan_items
  ADD CONSTRAINT daily_plan_items_scheduled_time_check
  CHECK (
    scheduled_time IS NOT NULL
    AND scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

ALTER TABLE daily_plan_items
  ALTER COLUMN scheduled_time SET NOT NULL;

ALTER TABLE daily_plan_items
  DROP COLUMN IF EXISTS scheduled_block;
