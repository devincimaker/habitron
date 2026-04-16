ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

ALTER TABLE todos
  DROP CONSTRAINT IF EXISTS todos_scheduled_time_check;

ALTER TABLE todos
  ADD CONSTRAINT todos_scheduled_time_check
  CHECK (
    scheduled_time IS NULL
    OR scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

UPDATE todos
SET scheduled_time = CASE scheduled_block
  WHEN 'morning' THEN '09:00'
  WHEN 'afternoon' THEN '13:00'
  WHEN 'evening' THEN '18:00'
  ELSE scheduled_time
END
WHERE scheduled_time IS NULL
  AND scheduled_block IS NOT NULL;

ALTER TABLE todos
  DROP COLUMN IF EXISTS scheduled_block;
