-- Task order becomes per-list. 20260827000002 made todos.position one dense
-- 0..n per user, but the app now shows and drags tasks inside a single list,
-- so the rank a drop rewrites is the list's own. Seed each list from the order
-- the user sees today: keep every list's relative order, renumbered densely
-- from 0. Completed and canceled tasks keep their slots — position is a
-- whole-list rank, visibility is a filter.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, list_id
           ORDER BY position, created_at
         ) - 1 AS rank
  FROM todos
)
UPDATE todos t
SET position = ranked.rank
FROM ranked
WHERE ranked.id = t.id;

-- The read path is now one list's tasks in order.
DROP INDEX IF EXISTS idx_todos_user_position;
CREATE INDEX IF NOT EXISTS idx_todos_user_list_position
  ON todos(user_id, list_id, position);
