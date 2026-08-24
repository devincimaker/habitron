-- Checklists on tasks: an ordered list of small items ticked off individually.
-- A task "has a checklist" iff it has at least one item; no flag column.

CREATE TABLE IF NOT EXISTS todo_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todo_checklist_items_todo_position
  ON todo_checklist_items(todo_id, position);

ALTER TABLE todo_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own todo_checklist_items" ON todo_checklist_items;
CREATE POLICY "Users can view own todo_checklist_items"
  ON todo_checklist_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own todo_checklist_items" ON todo_checklist_items;
CREATE POLICY "Users can insert own todo_checklist_items"
  ON todo_checklist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own todo_checklist_items" ON todo_checklist_items;
CREATE POLICY "Users can update own todo_checklist_items"
  ON todo_checklist_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own todo_checklist_items" ON todo_checklist_items;
CREATE POLICY "Users can delete own todo_checklist_items"
  ON todo_checklist_items FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_todo_checklist_items_updated_at ON todo_checklist_items;
CREATE TRIGGER update_todo_checklist_items_updated_at
  BEFORE UPDATE ON todo_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
