-- A goal is a row in `goals` now (HAB-126), with a measure and a date the coach
-- can plan toward, so a memory can no longer be one. What was filed under the
-- category keeps its content as a general memory; nothing is deleted.
UPDATE memories SET category = 'general' WHERE category = 'goal';

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_category_check;
ALTER TABLE memories
  ADD CONSTRAINT memories_category_check
  CHECK (category IN ('motivation', 'obstacle', 'preference', 'personal', 'general'));
