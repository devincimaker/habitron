-- Expand Habitron into a broader life planning system.

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  priority INTEGER CHECK (priority BETWEEN 1 AND 4),
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS todo_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  is_inbox BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'canceled')),
  priority INTEGER CHECK (priority BETWEEN 1 AND 4),
  due_date DATE,
  scheduled_date DATE,
  scheduled_block TEXT CHECK (scheduled_block IN ('morning', 'afternoon', 'evening')),
  estimate_minutes INTEGER CHECK (estimate_minutes > 0),
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todo_tag_assignments (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES todo_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  body TEXT NOT NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  stress INTEGER CHECK (stress BETWEEN 1 AND 5),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'coach')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'superseded', 'discarded')),
  source TEXT NOT NULL DEFAULT 'coach' CHECK (source IN ('coach', 'user')),
  parent_plan_id UUID REFERENCES daily_plans(id) ON DELETE SET NULL,
  rationale TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plan_date, version)
);

CREATE TABLE IF NOT EXISTS daily_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('habit', 'todo', 'note')),
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  title_snapshot TEXT NOT NULL,
  notes_snapshot TEXT,
  scheduled_block TEXT NOT NULL CHECK (scheduled_block IN ('morning', 'afternoon', 'evening')),
  estimate_minutes_snapshot INTEGER CHECK (estimate_minutes_snapshot > 0),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'planned' CHECK (outcome IN (
    'planned',
    'completed_as_planned',
    'completed_after_adjustment',
    'deferred',
    'removed',
    'canceled',
    'not_done'
  )),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_plan_item_reference_check CHECK (
    (item_type = 'habit' AND habit_id IS NOT NULL AND todo_id IS NULL)
    OR
    (item_type = 'todo' AND todo_id IS NOT NULL AND habit_id IS NULL)
    OR
    (item_type = 'note' AND habit_id IS NULL AND todo_id IS NULL)
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_habits_goal_id ON habits(goal_id);

CREATE INDEX IF NOT EXISTS idx_todo_lists_user_id ON todo_lists(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_lists_one_inbox_per_user
  ON todo_lists(user_id)
  WHERE is_inbox;

CREATE INDEX IF NOT EXISTS idx_todo_tags_user_id ON todo_tags(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_tags_user_name
  ON todo_tags(user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date ON todos(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_user_scheduled_date ON todos(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_todos_goal_id ON todos(goal_id);
CREATE INDEX IF NOT EXISTS idx_todos_list_id ON todos(list_id);

CREATE INDEX IF NOT EXISTS idx_todo_tag_assignments_user_id ON todo_tag_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tag_assignments_tag_id ON todo_tag_assignments(tag_id);

CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date ON diary_entries(user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plans_one_accepted_per_day
  ON daily_plans(user_id, plan_date)
  WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_daily_plan_items_plan_id ON daily_plan_items(plan_id, position);
CREATE INDEX IF NOT EXISTS idx_daily_plan_items_todo_id ON daily_plan_items(todo_id);
CREATE INDEX IF NOT EXISTS idx_daily_plan_items_habit_id ON daily_plan_items(habit_id);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_lists_updated_at ON todo_lists;
CREATE TRIGGER update_todo_lists_updated_at
  BEFORE UPDATE ON todo_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_tags_updated_at ON todo_tags;
CREATE TRIGGER update_todo_tags_updated_at
  BEFORE UPDATE ON todo_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_diary_entries_updated_at ON diary_entries;
CREATE TRIGGER update_diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_plans_updated_at ON daily_plans;
CREATE TRIGGER update_daily_plans_updated_at
  BEFORE UPDATE ON daily_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_plan_items_updated_at ON daily_plan_items;
CREATE TRIGGER update_daily_plan_items_updated_at
  BEFORE UPDATE ON daily_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own todo_lists" ON todo_lists;
CREATE POLICY "Users can view own todo_lists"
  ON todo_lists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own todo_lists" ON todo_lists;
CREATE POLICY "Users can insert own todo_lists"
  ON todo_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own todo_lists" ON todo_lists;
CREATE POLICY "Users can update own todo_lists"
  ON todo_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own todo_lists" ON todo_lists;
CREATE POLICY "Users can delete own todo_lists"
  ON todo_lists FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own todo_tags" ON todo_tags;
CREATE POLICY "Users can view own todo_tags"
  ON todo_tags FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own todo_tags" ON todo_tags;
CREATE POLICY "Users can insert own todo_tags"
  ON todo_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own todo_tags" ON todo_tags;
CREATE POLICY "Users can update own todo_tags"
  ON todo_tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own todo_tags" ON todo_tags;
CREATE POLICY "Users can delete own todo_tags"
  ON todo_tags FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own todos" ON todos;
CREATE POLICY "Users can view own todos"
  ON todos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
CREATE POLICY "Users can insert own todos"
  ON todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own todos" ON todos;
CREATE POLICY "Users can update own todos"
  ON todos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own todos" ON todos;
CREATE POLICY "Users can delete own todos"
  ON todos FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own todo_tag_assignments" ON todo_tag_assignments;
CREATE POLICY "Users can view own todo_tag_assignments"
  ON todo_tag_assignments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own todo_tag_assignments" ON todo_tag_assignments;
CREATE POLICY "Users can insert own todo_tag_assignments"
  ON todo_tag_assignments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own todo_tag_assignments" ON todo_tag_assignments;
CREATE POLICY "Users can delete own todo_tag_assignments"
  ON todo_tag_assignments FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own diary_entries" ON diary_entries;
CREATE POLICY "Users can view own diary_entries"
  ON diary_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own diary_entries" ON diary_entries;
CREATE POLICY "Users can insert own diary_entries"
  ON diary_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own diary_entries" ON diary_entries;
CREATE POLICY "Users can update own diary_entries"
  ON diary_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own diary_entries" ON diary_entries;
CREATE POLICY "Users can delete own diary_entries"
  ON diary_entries FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own daily_plans" ON daily_plans;
CREATE POLICY "Users can view own daily_plans"
  ON daily_plans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily_plans" ON daily_plans;
CREATE POLICY "Users can insert own daily_plans"
  ON daily_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily_plans" ON daily_plans;
CREATE POLICY "Users can update own daily_plans"
  ON daily_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily_plans" ON daily_plans;
CREATE POLICY "Users can delete own daily_plans"
  ON daily_plans FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own daily_plan_items" ON daily_plan_items;
CREATE POLICY "Users can view own daily_plan_items"
  ON daily_plan_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily_plan_items" ON daily_plan_items;
CREATE POLICY "Users can insert own daily_plan_items"
  ON daily_plan_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily_plan_items" ON daily_plan_items;
CREATE POLICY "Users can update own daily_plan_items"
  ON daily_plan_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily_plan_items" ON daily_plan_items;
CREATE POLICY "Users can delete own daily_plan_items"
  ON daily_plan_items FOR DELETE
  USING (auth.uid() = user_id);
