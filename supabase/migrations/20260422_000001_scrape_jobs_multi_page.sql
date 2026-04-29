-- Add multi_page flag to scrape_jobs.
-- Existing rows default to false, preserving current single-page behaviour.
ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS multi_page boolean NOT NULL DEFAULT false;
