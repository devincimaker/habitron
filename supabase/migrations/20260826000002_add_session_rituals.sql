-- Rituals: a coaching session can be the day's "plan the day" or "review the
-- day" rather than an open-ended chat.
--
-- `opener` is the skill the session's first turn sends, and it is also what the
-- hub and the session list read to show a sun or a moon instead of a chat
-- bubble. `ritual_date` is the day the ritual is *for*, which is not always the
-- day it happens: a review of last night done this morning belongs to last
-- night.

ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS opener TEXT NOT NULL DEFAULT 'coach'
    CHECK (opener IN ('coach', 'plan-day', 'review-day'));

ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS ritual_date DATE;

-- The "one session per ritual per day" rule, enforced where it cannot be raced.
-- Partial, so ordinary `coach` sessions (ritual_date IS NULL) stay unlimited.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_sessions_ritual
  ON coaching_sessions(user_id, opener, ritual_date)
  WHERE ritual_date IS NOT NULL;

-- A ritual session must name its day, and a plain chat must not claim one.
ALTER TABLE coaching_sessions
  DROP CONSTRAINT IF EXISTS coaching_sessions_ritual_date_matches_opener;
ALTER TABLE coaching_sessions
  ADD CONSTRAINT coaching_sessions_ritual_date_matches_opener
  CHECK ((opener = 'coach') = (ritual_date IS NULL));
