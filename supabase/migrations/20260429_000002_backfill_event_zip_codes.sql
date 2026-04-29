-- Scraped events may omit their own ZIP while the linked venue has one.
-- Backfill event ZIPs so ZIP searches can find already-saved scraper rows.

UPDATE public.events AS e
SET zip_code = v.zip_code
FROM public.venues AS v
WHERE e.venue_id = v.id
  AND e.zip_code IS NULL
  AND v.zip_code IS NOT NULL;
