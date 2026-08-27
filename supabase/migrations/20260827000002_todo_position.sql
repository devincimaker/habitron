-- todos.sort_order was a BIGINT holding Date.now() at creation and never
-- written again, so it only ever broke ties: the screens sorted by date, time
-- and priority in front of it. Manual order needs what habits.position is
-- (20260826000003): one dense 0..n index per user that every drop rewrites.
-- Renamed rather than added, so there is exactly one ordering column.

ALTER TABLE todos RENAME COLUMN sort_order TO position;

-- Seed from the order the screens showed, so nothing visibly moves on first
-- load: date, then a timed task before an untimed one, then priority (the
-- screens read NULL as the lowest), then the old creation stamp.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY COALESCE(scheduled_date, due_date) NULLS LAST,
                    scheduled_time NULLS LAST,
                    priority NULLS LAST,
                    position,
                    created_at
         ) - 1 AS rank
  FROM todos
)
UPDATE todos t SET position = ranked.rank FROM ranked WHERE ranked.id = t.id;

-- Dense per-user ranks fit INTEGER; BIGINT only existed for the millisecond stamps.
ALTER TABLE todos ALTER COLUMN position SET DATA TYPE INTEGER;

CREATE INDEX IF NOT EXISTS idx_todos_user_position ON todos(user_id, position);
