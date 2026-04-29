-- Scraper schema expansion
-- Adds rich venue/event fields from the web scraper and creates a notifications table.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Relax NOT NULL constraints so the scraper can create venues/events
--    without an owning user, an exact category, or a known end time.
-- ---------------------------------------------------------------------------

ALTER TABLE public.venues  ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.venues  ALTER COLUMN zip_code DROP NOT NULL;

ALTER TABLE public.events ALTER COLUMN venue_id  DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN category   DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN end_time   DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN zip_code   DROP NOT NULL;

-- Allow events where end_time is unknown (NULL passes CHECK automatically,
-- but rewrite the constraint to be explicit for documentation).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_time_window;
ALTER TABLE public.events ADD  CONSTRAINT events_time_window
  CHECK (end_time IS NULL OR end_time > start_time);

-- ---------------------------------------------------------------------------
-- 2) Expand venues table with scraper-sourced columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS website         text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS phone           text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS social_links    jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS legal_entity    jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS primary_contact jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS geo             jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS external_ids    jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS source_url      text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS data            jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS capacity        text;

CREATE INDEX IF NOT EXISTS idx_venues_name_lower  ON public.venues (lower(name));
CREATE INDEX IF NOT EXISTS idx_venues_source_url  ON public.venues (source_url);
CREATE INDEX IF NOT EXISTS idx_venues_city_state  ON public.venues (city, state);

-- ---------------------------------------------------------------------------
-- 3) Expand events table with scraper-sourced columns
-- ---------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_events_fingerprint   ON public.events (fingerprint);
CREATE INDEX IF NOT EXISTS idx_events_source_domain ON public.events (source_domain);
CREATE INDEX IF NOT EXISTS idx_events_discovered_at ON public.events (discovered_at);

-- ---------------------------------------------------------------------------
-- 4) Notifications table (scraper activity tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   text,
  entity_name text,
  message     text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON public.notifications (read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications are accessed exclusively through the service-role key
-- (scraper and admin operations). No anon/user-level policies needed.

COMMIT;
