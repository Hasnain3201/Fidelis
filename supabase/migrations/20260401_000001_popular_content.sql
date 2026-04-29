CREATE OR REPLACE FUNCTION get_popular_content(limit_count int DEFAULT 10)
RETURNS TABLE (
    item_type text,              
    item_id uuid,
    label text,                  
    start_time timestamptz,      
    category text,               
    zip_code text,               
    venue_name text,             
    popularity_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH event_popularity AS (
    SELECT
        'event'::text AS item_type,
        e.id AS item_id,
        e.title AS label,
        e.start_time,
        e.category,
        e.zip_code,
        v.name AS venue_name,
        COUNT(f.event_id)::bigint AS popularity_count
    FROM favorites f
    JOIN events e ON f.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    GROUP BY e.id, e.title, e.start_time, e.category, e.zip_code, v.name
),
artist_popularity AS (
    SELECT
        'artist'::text AS item_type,
        a.id AS item_id,
        a.stage_name AS label,
        NULL::timestamptz AS start_time,
        a.genre::text AS category,
        NULL::text AS zip_code,
        NULL::text AS venue_name,
        COUNT(af.artist_id)::bigint AS popularity_count
    FROM artist_follows af
    JOIN artists a ON af.artist_id = a.id
    GROUP BY a.id, a.stage_name, a.genre
),
combined AS (
    SELECT * FROM event_popularity
    UNION ALL
    SELECT * FROM artist_popularity
)
SELECT *
FROM combined
ORDER BY popularity_count DESC, item_type, label
LIMIT GREATEST(limit_count, 1);
$$;