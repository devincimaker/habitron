-- Day reviews: one row per day, rating the day on four axes plus a verdict.
--
-- The axes are questions about the plan, not moods, and all four run the same
-- direction — higher is better — which is why the axis is `calm` and not
-- `stress`: one direction means one colour ramp and no axis reads backwards.
--
-- NULL means not asked. Nothing defaults to 3, so an unrated day never reads as
-- a middling one.

CREATE TABLE IF NOT EXISTS day_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  -- Is doing what I plan making me happy?
  happy       SMALLINT CHECK (happy    BETWEEN 1 AND 5),
  -- Am I overexerting?
  energy      SMALLINT CHECK (energy   BETWEEN 1 AND 5),
  -- Did it move the needle toward what I want?
  momentum    SMALLINT CHECK (momentum BETWEEN 1 AND 5),
  -- Is the plan crowding me?
  calm        SMALLINT CHECK (calm     BETWEEN 1 AND 5),
  -- The verdict, from the gut. Never computed from the axes, and allowed to
  -- disagree with them.
  overall     SMALLINT CHECK (overall  BETWEEN 1 AND 5),
  highlight   TEXT,
  friction    TEXT,
  -- How far the review got. The floor is banked before depth is ever offered.
  depth       TEXT NOT NULL DEFAULT 'quick' CHECK (depth IN ('quick', 'standard', 'deep')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, review_date)
);

CREATE INDEX IF NOT EXISTS idx_day_reviews_user_date
  ON day_reviews(user_id, review_date DESC);

DROP TRIGGER IF EXISTS update_day_reviews_updated_at ON day_reviews;
CREATE TRIGGER update_day_reviews_updated_at
  BEFORE UPDATE ON day_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE day_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own day reviews" ON day_reviews;
CREATE POLICY "Users can view own day reviews"
  ON day_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own day reviews" ON day_reviews;
CREATE POLICY "Users can insert own day reviews"
  ON day_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own day reviews" ON day_reviews;
CREATE POLICY "Users can update own day reviews"
  ON day_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own day reviews" ON day_reviews;
CREATE POLICY "Users can delete own day reviews"
  ON day_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- The dead columns day_reviews replaces
-- ============================================

-- journal_entries.energy and .stress arrived with 20260324000001_add_life_planning.sql
-- and were never read or written by a line of application code. Verified empty on
-- the production project before this ran: 5 journal rows, 0 non-null in either
-- column. The day's ratings live on day_reviews now; an entry's own `mood` stays,
-- because that is the entry's, not the day's.
ALTER TABLE journal_entries DROP COLUMN IF EXISTS energy;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS stress;
