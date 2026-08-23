-- Tags become categories: every task carries at most one tag.
-- Replace the todo_tag_assignments join table with todos.tag_id.

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES todo_tags(id) ON DELETE SET NULL;

-- Keep the earliest assignment per todo.
UPDATE todos t
SET tag_id = a.tag_id
FROM (
  SELECT DISTINCT ON (todo_id) todo_id, tag_id
  FROM todo_tag_assignments
  ORDER BY todo_id, created_at ASC, tag_id ASC
) a
WHERE a.todo_id = t.id;

CREATE INDEX IF NOT EXISTS idx_todos_tag_id ON todos(tag_id);

DROP TABLE IF EXISTS todo_tag_assignments;
