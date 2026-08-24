-- HAB-72 Part 2: the in-app coach is a Claude Agent SDK tool loop.
--
-- The proposal protocol is gone, and with it the per-session skill state and
-- the debug-event telemetry that existed to diagnose it. The coach's own
-- transcript now lives in an Agent SDK session, referenced from the app session.

DROP TABLE IF EXISTS coaching_session_debug_events;
DROP TABLE IF EXISTS coaching_skill_instances;

ALTER TABLE coaching_sessions
  ADD COLUMN claude_session_id TEXT;  -- Agent SDK session id; null until the first turn
