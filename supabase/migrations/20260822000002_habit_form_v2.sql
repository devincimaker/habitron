-- Habit form v2: interval frequency, quantified goals, start date, goal days,
-- sections, per-habit reminders, constant reminder + auto pop-up toggles.

-- ============================================
-- SECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS habit_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_habit_sections_user_id ON habit_sections(user_id);

ALTER TABLE habit_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own habit sections" ON habit_sections;
CREATE POLICY "Users can manage own habit sections" ON habit_sections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed default sections for every existing user.
INSERT INTO habit_sections (user_id, name, sort_order)
SELECT u.id, s.name, s.sort_order
FROM auth.users u
CROSS JOIN (
  VALUES ('Morning', 0), ('Afternoon', 1), ('Night', 2), ('Others', 3)
) AS s(name, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================
-- HABITS
-- ============================================

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS goal_days INTEGER,
  ADD COLUMN IF NOT EXISTS goal_type TEXT NOT NULL DEFAULT 'boolean',
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS check_in_mode TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS record_increment NUMERIC,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES habit_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS constant_reminder BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_popup_log BOOLEAN NOT NULL DEFAULT false;

UPDATE habits SET start_date = created_at::date WHERE start_date IS NULL;

ALTER TABLE habits
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN start_date SET DEFAULT CURRENT_DATE;

-- Map the old time_of_day enum onto the seeded sections, then drop it.
UPDATE habits h
SET section_id = s.id
FROM habit_sections s
WHERE s.user_id = h.user_id
  AND s.name = CASE h.time_of_day
    WHEN 'morning' THEN 'Morning'
    WHEN 'afternoon' THEN 'Afternoon'
    WHEN 'evening' THEN 'Night'
    ELSE 'Others'
  END
  AND h.section_id IS NULL;

ALTER TABLE habits DROP COLUMN IF EXISTS time_of_day;

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_frequency_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_frequency_check
  CHECK (frequency IN ('daily', 'weekly', 'interval'));

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_interval_days_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_interval_days_check
  CHECK (interval_days IS NULL OR interval_days BETWEEN 2 AND 365);

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_goal_days_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_goal_days_check
  CHECK (goal_days IS NULL OR goal_days BETWEEN 1 AND 999);

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_goal_type_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_goal_type_check
  CHECK (goal_type IN ('boolean', 'quantity'));

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_target_amount_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_target_amount_check
  CHECK (target_amount IS NULL OR target_amount > 0);

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_check_in_mode_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_check_in_mode_check
  CHECK (check_in_mode IN ('auto', 'manual', 'complete_all'));

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_record_increment_check;
ALTER TABLE habits
  ADD CONSTRAINT habits_record_increment_check
  CHECK (record_increment IS NULL OR record_increment > 0);

CREATE INDEX IF NOT EXISTS idx_habits_section_id ON habits(section_id);

-- ============================================
-- REMINDERS
-- ============================================

CREATE TABLE IF NOT EXISTS habit_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, time)
);

CREATE INDEX IF NOT EXISTS idx_habit_reminders_habit_id ON habit_reminders(habit_id);

ALTER TABLE habit_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own habit reminders" ON habit_reminders;
CREATE POLICY "Users can manage own habit reminders" ON habit_reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- LOGS: quantity tracking
-- ============================================

ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE habit_logs DROP CONSTRAINT IF EXISTS habit_logs_amount_check;
ALTER TABLE habit_logs
  ADD CONSTRAINT habit_logs_amount_check CHECK (amount >= 0);
