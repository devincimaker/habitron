-- HAB-113: a coach turn outlives the socket that started it. iOS tears the
-- stream down when the app is suspended, so the API records each turn here
-- and the session screen polls it (GET /api/sessions/:id/turn) to read the
-- reply back when its stream drops.
--
-- Shape: { prompt, status: 'running' }
--      | { prompt, status: 'done', reply }
--      | { prompt, status: 'failed', error }
-- Written by the API, overwritten by the next turn, never cleared. The app
-- owns `messages`, so the reply cannot be appended there without racing it.
ALTER TABLE coaching_sessions
  ADD COLUMN last_turn JSONB;
