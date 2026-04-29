CREATE OR REPLACE FUNCTION public.get_popular_artists(limit_count int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  stage_name text,
  genre text,
  bio text,
  media_url text,
  created_at timestamptz,
  updated_at timestamptz,
  popularity_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.stage_name,
    a.genre,
    a.bio,
    a.media_url,
    a.created_at,
    a.updated_at,
    COUNT(af.user_id)::bigint AS popularity_count
  FROM public.artists a
  LEFT JOIN public.artist_follows af ON af.artist_id = a.id
  GROUP BY a.id, a.stage_name, a.genre, a.bio, a.media_url, a.created_at, a.updated_at
  ORDER BY popularity_count DESC, a.stage_name ASC
  LIMIT GREATEST(limit_count, 1);
$$;


CREATE OR REPLACE FUNCTION public.get_recommended_artists(for_user uuid, limit_count int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  stage_name text,
  genre text,
  bio text,
  media_url text,
  created_at timestamptz,
  updated_at timestamptz,
  score bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH followed AS (
    SELECT af.artist_id
    FROM public.artist_follows af
    WHERE af.user_id = for_user
  ),
  liked_genres AS (
    SELECT DISTINCT a.genre
    FROM public.favorites f
    JOIN public.event_artists ea ON ea.event_id = f.event_id
    JOIN public.artists a ON a.id = ea.artist_id
    WHERE f.user_id = for_user
      AND a.genre IS NOT NULL
      AND a.genre <> ''
  ),
  popularity AS (
    SELECT af.artist_id, COUNT(*)::bigint AS followers
    FROM public.artist_follows af
    GROUP BY af.artist_id
  )
  SELECT
    a.id,
    a.stage_name,
    a.genre,
    a.bio,
    a.media_url,
    a.created_at,
    a.updated_at,
    (
      CASE WHEN f.artist_id IS NOT NULL THEN 30 ELSE 0 END +
      CASE WHEN lg.genre IS NOT NULL AND a.genre = lg.genre THEN 10 ELSE 0 END +
      COALESCE(p.followers, 0)
    )::bigint AS score
  FROM public.artists a
  LEFT JOIN followed f ON f.artist_id = a.id
  LEFT JOIN liked_genres lg ON lg.genre = a.genre
  LEFT JOIN popularity p ON p.artist_id = a.id
  ORDER BY score DESC, a.stage_name ASC
  LIMIT GREATEST(limit_count, 1);
$$;