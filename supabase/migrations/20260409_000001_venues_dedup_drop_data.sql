-- Venue deduplication + drop redundant data column
-- 1) Unique index on lower(name) to prevent duplicate venue names at the DB level.
-- 2) Drop the "data" JSONB column which stored raw AI output redundantly.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Unique constraint on venue name (case-insensitive)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_venues_name_lower;

CREATE UNIQUE INDEX idx_venues_name_unique
  ON public.venues (lower(name));

-- ---------------------------------------------------------------------------
-- 2) Drop the redundant "data" column
-- ---------------------------------------------------------------------------

ALTER TABLE public.venues DROP COLUMN IF EXISTS data;

COMMIT;
