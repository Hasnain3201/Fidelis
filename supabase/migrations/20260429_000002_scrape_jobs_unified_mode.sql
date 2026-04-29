-- Allow the 'unified' scrape mode introduced when venue/event/artist scraping
-- was consolidated into a single job type.

ALTER TABLE public.scrape_jobs
  DROP CONSTRAINT IF EXISTS scrape_jobs_mode_check;

ALTER TABLE public.scrape_jobs
  ADD CONSTRAINT scrape_jobs_mode_check
  CHECK (mode IN ('unified', 'venue', 'events'));
