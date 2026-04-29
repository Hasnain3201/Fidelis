-- Repair managed artist/venue linking used by /api/v1/*/mine creation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.venue_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      public.claim_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_claims_venue_user_unique UNIQUE (venue_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.artist_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      public.claim_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_claims_artist_user_unique UNIQUE (artist_id, user_id)
);

ALTER TABLE public.venue_claims
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.artist_claims
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_managed_venue_id
  ON public.profiles(managed_venue_id);

CREATE INDEX IF NOT EXISTS idx_profiles_managed_artist_id
  ON public.profiles(managed_artist_id);

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMIT;
