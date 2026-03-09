-- Claims-based ownership migration
-- Venues and artists can exist before account owners are known.
-- Users submit claims which require admin approval before they can manage entities.

BEGIN;

-- 1) claim_status enum
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Make owner_id nullable so venues/artists can exist without a profile link
-- ALTER TABLE public.venues  ALTER COLUMN owner_id DROP NOT NULL;
-- ALTER TABLE public.artists ALTER COLUMN owner_id DROP NOT NULL;

-- 3) Venue claims
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

-- 4) Artist claims
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

-- 5) updated_at triggers
CREATE TRIGGER trg_venue_claims_updated_at
  BEFORE UPDATE ON public.venue_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_artist_claims_updated_at
  BEFORE UPDATE ON public.artist_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Enable RLS
ALTER TABLE public.venue_claims  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_claims ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Claim table RLS
-- =========================================================================

-- Users can read their own claims
CREATE POLICY "venue_claims_select_self"
  ON public.venue_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "artist_claims_select_self"
  ON public.artist_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert pending claims for themselves only
CREATE POLICY "venue_claims_insert_self"
  ON public.venue_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "artist_claims_insert_self"
  ON public.artist_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- =========================================================================
-- Replace owner-based venue/artist write policies with claim-based ones
-- =========================================================================

-- Drop old owner-based policies
DROP POLICY IF EXISTS "venues_insert_owner"  ON public.venues;
DROP POLICY IF EXISTS "venues_update_owner"  ON public.venues;
DROP POLICY IF EXISTS "venues_delete_owner"  ON public.venues;

DROP POLICY IF EXISTS "artists_insert_owner"  ON public.artists;
DROP POLICY IF EXISTS "artists_update_owner"  ON public.artists;
DROP POLICY IF EXISTS "artists_delete_owner"  ON public.artists;

-- Venue writes require an approved claim
CREATE POLICY "venues_update_claimant"
  ON public.venues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_claims vc
      WHERE vc.venue_id = id AND vc.user_id = auth.uid() AND vc.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venue_claims vc
      WHERE vc.venue_id = id AND vc.user_id = auth.uid() AND vc.status = 'approved'
    )
  );

CREATE POLICY "venues_delete_claimant"
  ON public.venues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_claims vc
      WHERE vc.venue_id = id AND vc.user_id = auth.uid() AND vc.status = 'approved'
    )
  );

-- Artist writes require an approved claim
CREATE POLICY "artists_update_claimant"
  ON public.artists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_claims ac
      WHERE ac.artist_id = id AND ac.user_id = auth.uid() AND ac.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_claims ac
      WHERE ac.artist_id = id AND ac.user_id = auth.uid() AND ac.status = 'approved'
    )
  );

CREATE POLICY "artists_delete_claimant"
  ON public.artists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_claims ac
      WHERE ac.artist_id = id AND ac.user_id = auth.uid() AND ac.status = 'approved'
    )
  );

COMMIT;
