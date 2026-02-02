-- Add daily_reminder_enabled column to user_profiles
-- Allows users to toggle daily coaching session reminders

ALTER TABLE user_profiles
  ADD COLUMN daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE;
