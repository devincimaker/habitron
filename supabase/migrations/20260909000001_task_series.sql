-- Recurring tasks (HAB-199).
--
-- A series is the rule; its occurrences are ordinary todos that point back at
-- it through series_id and remember which slot they fill through series_date.
-- Occurrences are materialised a window ahead (generated_until is the
-- watermark), and the latest occurrence is the template for the next ones, so
-- there is no separate template row: an edit "from this one on" is one update
-- over the later open siblings.

CREATE TABLE IF NOT EXISTS task_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  -- 0 = Sunday … 6 = Saturday, as EXTRACT(dow) counts. Empty for monthly.
  weekdays SMALLINT[] NOT NULL DEFAULT '{}'
    CHECK (weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]),
  start_date DATE NOT NULL,
  end_date DATE CHECK (end_date IS NULL OR end_date >= start_date),
  -- Occurrences exist up to and including this date.
  generated_until DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (frequency = 'monthly' OR cardinality(weekdays) > 0)
);

CREATE INDEX IF NOT EXISTS idx_task_series_user_id ON task_series(user_id);

ALTER TABLE task_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own task_series" ON task_series;
CREATE POLICY "Users can view own task_series"
  ON task_series FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own task_series" ON task_series;
CREATE POLICY "Users can insert own task_series"
  ON task_series FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own task_series" ON task_series;
CREATE POLICY "Users can update own task_series"
  ON task_series FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own task_series" ON task_series;
CREATE POLICY "Users can delete own task_series"
  ON task_series FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_task_series_updated_at ON task_series;
CREATE TRIGGER update_task_series_updated_at
  BEFORE UPDATE ON task_series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- An occurrence keeps its slot in series_date even when its scheduled_date is
-- moved, so a moved occurrence is not generated a second time.
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES task_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_series_date
  ON todos(series_id, series_date)
  WHERE series_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rule evaluation
-- ---------------------------------------------------------------------------

-- Every date in [p_from, p_to] the series falls on, clipped to its own range.
-- Biweekly counts Sunday-based weeks from the start date's week; monthly is
-- the start date's day of month, clamped to shorter months.
CREATE OR REPLACE FUNCTION task_series_dates(s task_series, p_from DATE, p_to DATE)
RETURNS SETOF DATE
LANGUAGE sql
STABLE
AS $$
  SELECT d::date
  FROM generate_series(
    GREATEST(s.start_date, p_from)::timestamp,
    LEAST(p_to, COALESCE(s.end_date, p_to))::timestamp,
    interval '1 day'
  ) AS d
  WHERE CASE s.frequency
    WHEN 'weekly' THEN
      EXTRACT(dow FROM d)::smallint = ANY (s.weekdays)
    WHEN 'biweekly' THEN
      EXTRACT(dow FROM d)::smallint = ANY (s.weekdays)
      AND (((d::date - (s.start_date - EXTRACT(dow FROM s.start_date)::int)) / 7) % 2) = 0
    WHEN 'monthly' THEN
      EXTRACT(day FROM d) = LEAST(
        EXTRACT(day FROM s.start_date),
        EXTRACT(day FROM (date_trunc('month', d) + interval '1 month - 1 day'))
      )
  END
$$;

-- ---------------------------------------------------------------------------
-- Materialisation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION next_todo_position(p_user_id UUID, p_list_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(position) + 1, 0)
  FROM todos
  WHERE user_id = p_user_id AND list_id = p_list_id
$$;

-- A new occurrence is the template's copy on p_date: same list, category,
-- goal, time, estimate and checklist (unticked), appended to the list order.
CREATE OR REPLACE FUNCTION clone_task_occurrence(p_template todos, p_date DATE)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO todos (
    user_id, list_id, goal_id, tag_id, title, notes, priority,
    scheduled_date, scheduled_time, estimate_minutes, position, status,
    series_id, series_date
  )
  VALUES (
    p_template.user_id, p_template.list_id, p_template.goal_id, p_template.tag_id,
    p_template.title, p_template.notes, p_template.priority,
    p_date, p_template.scheduled_time, p_template.estimate_minutes,
    next_todo_position(p_template.user_id, p_template.list_id), 'open',
    p_template.series_id, p_date
  )
  RETURNING id INTO v_id;

  INSERT INTO todo_checklist_items (user_id, todo_id, title, done, position)
  SELECT user_id, v_id, title, FALSE, position
  FROM todo_checklist_items
  WHERE todo_id = p_template.id;

  RETURN v_id;
END;
$$;

-- Generates every missing occurrence up to p_until for the user's series.
-- Runs under the caller's RLS: the app passes its own id, the coach's service
-- role passes the user it acts for. Returns how many rows were created.
CREATE OR REPLACE FUNCTION materialize_task_series(p_until DATE, p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  s task_series;
  template todos;
  d DATE;
  created INTEGER := 0;
BEGIN
  FOR s IN
    SELECT *
    FROM task_series
    WHERE user_id = p_user_id
      AND generated_until < p_until
      AND (end_date IS NULL OR generated_until < end_date)
    ORDER BY created_at
  LOOP
    SELECT * INTO template
    FROM todos
    WHERE series_id = s.id
    ORDER BY series_date DESC
    LIMIT 1;

    IF FOUND THEN
      FOR d IN SELECT * FROM task_series_dates(s, s.generated_until + 1, p_until) LOOP
        IF NOT EXISTS (SELECT 1 FROM todos WHERE series_id = s.id AND series_date = d) THEN
          PERFORM clone_task_occurrence(template, d);
          created := created + 1;
        END IF;
      END LOOP;
    END IF;

    UPDATE task_series SET generated_until = p_until WHERE id = s.id;
  END LOOP;

  RETURN created;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rule changes, always from one occurrence
-- ---------------------------------------------------------------------------

-- Makes p_todo_id repeat by the given rule from its scheduled date on. On a
-- task already in a series the rule changes from this occurrence on: later
-- open occurrences are dropped and regenerated. Returns the series id.
CREATE OR REPLACE FUNCTION set_task_repeat(
  p_todo_id UUID,
  p_frequency TEXT,
  p_weekdays SMALLINT[],
  p_end_date DATE,
  p_until DATE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  t todos;
  v_series_id UUID;
  v_weekdays SMALLINT[] := COALESCE(p_weekdays, '{}');
BEGIN
  SELECT * INTO t FROM todos WHERE id = p_todo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_todo_id;
  END IF;
  IF t.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'A repeating task needs a scheduled date';
  END IF;

  IF t.series_id IS NULL THEN
    INSERT INTO task_series (user_id, frequency, weekdays, start_date, end_date, generated_until)
    VALUES (t.user_id, p_frequency, v_weekdays, t.scheduled_date, p_end_date, t.scheduled_date)
    RETURNING id INTO v_series_id;
  ELSE
    v_series_id := t.series_id;
    DELETE FROM todos
    WHERE series_id = v_series_id
      AND id <> p_todo_id
      AND series_date > LEAST(t.series_date, t.scheduled_date)
      AND status <> 'completed';
    UPDATE task_series
    SET frequency = p_frequency,
        weekdays = v_weekdays,
        start_date = LEAST(start_date, t.scheduled_date),
        end_date = p_end_date,
        generated_until = t.scheduled_date
    WHERE id = v_series_id;
  END IF;

  UPDATE todos
  SET series_id = v_series_id, series_date = t.scheduled_date
  WHERE id = p_todo_id;

  PERFORM materialize_task_series(p_until, t.user_id);
  RETURN v_series_id;
END;
$$;

-- Stops the series at p_todo_id: this task becomes a plain one, later open
-- occurrences are dropped, and the series ends before it (or goes away when
-- nothing else refers to it).
CREATE OR REPLACE FUNCTION stop_task_series(p_todo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  t todos;
  remaining INTEGER;
BEGIN
  SELECT * INTO t FROM todos WHERE id = p_todo_id;
  IF NOT FOUND OR t.series_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM todos
  WHERE series_id = t.series_id
    AND series_date > t.series_date
    AND status <> 'completed';

  UPDATE todos SET series_id = NULL, series_date = NULL WHERE id = p_todo_id;

  SELECT COUNT(*) INTO remaining FROM todos WHERE series_id = t.series_id;
  IF remaining = 0 THEN
    DELETE FROM task_series WHERE id = t.series_id;
  ELSE
    UPDATE task_series
    SET end_date = GREATEST(start_date, t.series_date - 1)
    WHERE id = t.series_id;
  END IF;
END;
$$;

-- Copies p_todo_id's fields onto its later open occurrences: everything but
-- the date, the status and the position. Returns how many were updated.
CREATE OR REPLACE FUNCTION sync_task_series_from(p_todo_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  t todos;
  sibling todos;
  updated INTEGER := 0;
BEGIN
  SELECT * INTO t FROM todos WHERE id = p_todo_id;
  IF NOT FOUND OR t.series_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR sibling IN
    SELECT * FROM todos
    WHERE series_id = t.series_id AND series_date > t.series_date AND status = 'open'
  LOOP
    UPDATE todos
    SET title = t.title,
        notes = t.notes,
        priority = t.priority,
        goal_id = t.goal_id,
        tag_id = t.tag_id,
        estimate_minutes = t.estimate_minutes,
        scheduled_time = t.scheduled_time,
        list_id = t.list_id,
        position = CASE
          WHEN sibling.list_id = t.list_id THEN sibling.position
          ELSE next_todo_position(t.user_id, t.list_id)
        END
    WHERE id = sibling.id;

    DELETE FROM todo_checklist_items WHERE todo_id = sibling.id;
    INSERT INTO todo_checklist_items (user_id, todo_id, title, done, position)
    SELECT user_id, sibling.id, title, FALSE, position
    FROM todo_checklist_items
    WHERE todo_id = t.id;

    updated := updated + 1;
  END LOOP;

  RETURN updated;
END;
$$;
