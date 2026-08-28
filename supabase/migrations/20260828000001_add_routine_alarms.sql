-- Routine alarms: a habit section can ring at its start time through AlarmKit.
-- Separate from habit_reminders, which stays exactly as it is: a reminder is a
-- notification, an alarm rings through Silent and Focus until dismissed.

ALTER TABLE habit_sections
  ADD COLUMN IF NOT EXISTS alarm_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per weekday, so "a day rings once" is the primary key and the week
-- strip maps to it 1:1. Weekday values are the app's HABIT_WEEKDAYS, so
-- HabitSection.alarmByDay keys need no translation on the way in or out.
CREATE TABLE IF NOT EXISTS habit_section_alarms (
  section_id UUID NOT NULL REFERENCES habit_sections(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday    TEXT NOT NULL CHECK (weekday IN ('Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat')),
  time       TIME NOT NULL,
  PRIMARY KEY (section_id, weekday)
);

ALTER TABLE habit_section_alarms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own habit section alarms" ON habit_section_alarms;
CREATE POLICY "Users can manage own habit section alarms" ON habit_section_alarms
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
