-- Add scraper-populated columns to venues table.
-- These fields are written by the AI scraper and were missing from the initial schema.

BEGIN;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS capacity      integer,
  ADD COLUMN IF NOT EXISTS website       text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS social_links  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legal_entity  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_contact jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS geo           jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_ids  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url    text,
  ADD COLUMN IF NOT EXISTS data          jsonb;

COMMIT;
