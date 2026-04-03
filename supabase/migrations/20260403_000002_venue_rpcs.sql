CREATE OR REPLACE FUNCTION public.get_popular_venues(limit_count int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  address_line text,
  city text,
  state text,
  zip_code text,
  verified boolean,
  popularity_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.name,
    v.description,
    v.address_line,
    v.city,
    v.state,
    v.zip_code,
    v.verified,
    COUNT(vf.user_id)::bigint AS popularity_count
  FROM public.venues v
  LEFT JOIN public.venue_follows vf ON vf.venue_id = v.id
  GROUP BY v.id, v.name, v.description, v.address_line, v.city, v.state, v.zip_code, v.verified
  ORDER BY popularity_count DESC, v.verified DESC, v.name ASC
  LIMIT GREATEST(limit_count, 1);
$$;


CREATE OR REPLACE FUNCTION public.get_recommended_venues(for_user uuid, limit_count int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  address_line text,
  city text,
  state text,
  zip_code text,
  verified boolean,
  score bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.home_zip, p.city, p.state
    FROM public.profiles p
    WHERE p.id = for_user
    LIMIT 1
  ),
  follows AS (
    SELECT vf.venue_id
    FROM public.venue_follows vf
    WHERE vf.user_id = for_user
  ),
  popularity AS (
    SELECT vf.venue_id, COUNT(*)::bigint AS followers
    FROM public.venue_follows vf
    GROUP BY vf.venue_id
  )
  SELECT
    v.id,
    v.name,
    v.description,
    v.address_line,
    v.city,
    v.state,
    v.zip_code,
    v.verified,
    (
      CASE WHEN f.venue_id IS NOT NULL THEN 30 ELSE 0 END +
      CASE WHEN m.city IS NOT NULL  AND v.city  ILIKE m.city  THEN 10 ELSE 0 END +
      CASE WHEN m.state IS NOT NULL AND v.state ILIKE m.state THEN 8  ELSE 0 END +
      CASE WHEN m.home_zip IS NOT NULL AND v.zip_code = m.home_zip THEN 12 ELSE 0 END +
      COALESCE(p.followers, 0)
    )::bigint AS score
  FROM public.venues v
  CROSS JOIN me m
  LEFT JOIN follows f ON f.venue_id = v.id
  LEFT JOIN popularity p ON p.venue_id = v.id
  ORDER BY score DESC, v.verified DESC, v.name ASC
  LIMIT GREATEST(limit_count, 1);
$$;