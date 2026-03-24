DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'diary_entries'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE public.diary_entries RENAME TO journal_entries;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'body'
  ) THEN
    ALTER TABLE public.journal_entries RENAME COLUMN body TO content;
  END IF;
END $$;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

UPDATE public.journal_entries
SET entry_date = COALESCE(entry_date, (created_at AT TIME ZONE 'UTC')::DATE)
WHERE entry_date IS NULL;

DO $$
DECLARE
  mood_type TEXT;
BEGIN
  SELECT data_type
  INTO mood_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'journal_entries'
    AND column_name = 'mood';

  IF mood_type = 'integer' THEN
    ALTER TABLE public.journal_entries ADD COLUMN mood_v2 TEXT;

    UPDATE public.journal_entries
    SET mood_v2 = CASE mood
      WHEN 5 THEN 'great'
      WHEN 4 THEN 'good'
      WHEN 3 THEN 'neutral'
      WHEN 2 THEN 'bad'
      WHEN 1 THEN 'terrible'
      ELSE NULL
    END;

    ALTER TABLE public.journal_entries DROP COLUMN mood;
    ALTER TABLE public.journal_entries RENAME COLUMN mood_v2 TO mood;
  END IF;
END $$;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS diary_entries_mood_check;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_mood_check;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_mood_check
  CHECK (mood IS NULL OR mood IN ('great', 'good', 'neutral', 'bad', 'terrible'));

DROP INDEX IF EXISTS public.idx_diary_entries_user_date;
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created_at
  ON public.journal_entries(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_diary_entries_updated_at ON public.journal_entries;
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diary_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own diary_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own diary_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own diary_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can view own journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal_entries" ON public.journal_entries;

CREATE POLICY "Users can view own journal_entries"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal_entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal_entries"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal_entries"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);
