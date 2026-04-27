-- Drop NOT NULL constraint on zip_code in venues and events.
-- The AI scraper often cannot extract a zip code from venue websites,
-- and the character(5) type rejects ZIP+4 format (e.g. "10011-4321").
-- Nulls are handled gracefully by application code which normalizes
-- zip values to 5 digits before insert.

ALTER TABLE public.venues
  ALTER COLUMN zip_code DROP NOT NULL;

ALTER TABLE public.events
  ALTER COLUMN zip_code DROP NOT NULL;
