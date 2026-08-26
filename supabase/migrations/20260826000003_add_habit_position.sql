-- Habit order inside a routine was an accident of created_at and could not be
-- changed. `position` is a dense 0..n index of a routine's habits, matching
-- daily_plan_items.position and todo_checklist_items.position. Deliberately not
-- todos.sort_order's Date.now() scheme, which had to be widened to BIGINT in
-- 20260327000001 — dense reindex on every drop is right for a list this small.

ALTER TABLE habits ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Seed the order from what the screen already showed, so nothing visibly moves
-- on first load. PARTITION BY user_id, section_id puts every section_id IS NULL
-- habit in one group, which is the "no routine" bucket the screen renders.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, section_id ORDER BY created_at, id) - 1 AS rank
  FROM habits
)
UPDATE habits h SET position = ranked.rank FROM ranked WHERE ranked.id = h.id;

CREATE INDEX IF NOT EXISTS idx_habits_section_position ON habits(user_id, section_id, position);
