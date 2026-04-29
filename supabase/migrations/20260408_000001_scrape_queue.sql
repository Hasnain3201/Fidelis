-- Scrape queue + standardized venue columns
-- Adds the scrape_jobs table that backs the admin scraper queue,
-- plus first-class venue columns for fields the AI already extracts.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Standardized venue columns (previously stored only inside venues.data)
-- ---------------------------------------------------------------------------

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS venue_type  text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS confidence  numeric DEFAULT 0.0;

CREATE INDEX IF NOT EXISTS idx_venues_venue_type ON public.venues (venue_type);

-- ---------------------------------------------------------------------------
-- 2) Scrape jobs queue table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid,
  url             text NOT NULL,
  mode            text NOT NULL CHECK (mode IN ('venue','events')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','failed')),
  enable_render   boolean NOT NULL DEFAULT false,
  dry_run         boolean NOT NULL DEFAULT false,
  venue_id_hint   uuid,
  priority        integer NOT NULL DEFAULT 0,
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 1,
  result          jsonb,
  content_preview jsonb,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_priority
  ON public.scrape_jobs (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_batch_id
  ON public.scrape_jobs (batch_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at
  ON public.scrape_jobs (created_at DESC);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
-- service-role only, matches notifications table policy.

COMMIT;
