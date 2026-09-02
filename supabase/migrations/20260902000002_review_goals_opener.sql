-- The goals review is a ritual like the two daily ones (HAB-196): a session
-- whose first turn is /review-goals, one per day, found rather than duplicated
-- by the partial unique index from 20260826000002. The column's CHECK was
-- declared inline with the column, so Postgres named it itself.
ALTER TABLE coaching_sessions DROP CONSTRAINT IF EXISTS coaching_sessions_opener_check;
ALTER TABLE coaching_sessions
  ADD CONSTRAINT coaching_sessions_opener_check
  CHECK (opener IN ('coach', 'plan-day', 'review-day', 'review-goals'));
