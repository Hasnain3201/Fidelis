-- =============================================
-- Top 20 Favorited events
-- =============================================

CREATE OR REPLACE FUNCTION get_popular_events(limit_count int DEFAULT 20)
RETURNS TABLE (
    event_id uuid,
    title text,
    start_time timestamptz,
    category text,
    zip_code text,
    venue_name text,
    favorite_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        e.id,
        e.title,
        e.start_time,
        e.category,
        e.zip_code,
        v.name AS venue_name,
        COUNT(f.event_id)
    FROM favorites f
    JOIN events e ON f.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    GROUP BY e.id, e.title, e.start_time, e.category, e.zip_code, v.name
    ORDER BY COUNT(f.event_id) DESC
    LIMIT limit_count;
$$;