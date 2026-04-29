-- Add scraper-populated columns to the events table and relax constraints
-- so the scraper can persist events extracted from arbitrary websites.
--
-- This is the events portion of the (apparently never-applied) 20260311
-- scraper_schema migration. The venues portion was already applied as
-- 20260408185528 (add_scraper_fields_to_venues), so only events lags.
--
-- Safe on existing rows: every column is nullable or defaulted, no backfills.

BEGIN;

-- 1) Allow scraper events without an exact venue, category, or end time.
ALTER TABLE public.events ALTER COLUMN venue_id DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN end_time DROP NOT NULL;

-- 2) Permit events with unknown end_time. (NULL would already pass the CHECK
--    by default, but rewriting it makes the intent explicit.)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_time_window;
ALTER TABLE public.events ADD CONSTRAINT events_time_window
  CHECK (end_time IS NULL OR end_time > start_time);

-- 3) Scraper-sourced columns.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS types           jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS genres          jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS social_media    jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_name      text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS timezone        text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS when_text       text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS where_text      text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS artists_data    jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price           jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS food_available  boolean;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_restriction text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS categories      jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags            jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_url       text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS images          jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_domain   text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url      text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS discovered_at   timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS fingerprint     text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confidence      numeric DEFAULT 0.0;

-- 4) Supporting indexes used by the scraper's dedup and listing paths.
CREATE INDEX IF NOT EXISTS idx_events_fingerprint   ON public.events (fingerprint);
CREATE INDEX IF NOT EXISTS idx_events_source_domain ON public.events (source_domain);
CREATE INDEX IF NOT EXISTS idx_events_discovered_at ON public.events (discovered_at);

COMMIT;
