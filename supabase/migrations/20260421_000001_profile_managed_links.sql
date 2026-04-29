BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_managed_venue_id
  ON public.profiles(managed_venue_id);

CREATE INDEX IF NOT EXISTS idx_profiles_managed_artist_id
  ON public.profiles(managed_artist_id);

COMMIT;
