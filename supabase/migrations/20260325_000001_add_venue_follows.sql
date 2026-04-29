-- Venue follows: users can follow venues they like
CREATE TABLE IF NOT EXISTS public.venue_follows (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_follows_venue_id
  ON public.venue_follows(venue_id);

ALTER TABLE public.venue_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_follows_select_self"
  ON public.venue_follows
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "venue_follows_insert_self"
  ON public.venue_follows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "venue_follows_delete_self"
  ON public.venue_follows
  FOR DELETE
  USING (auth.uid() = user_id);
