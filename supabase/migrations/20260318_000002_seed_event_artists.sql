-- =============================================
-- Seed 2 artists per event
-- =============================================

INSERT INTO event_artists (event_id, artist_id, created_at)
SELECT
    e.id,
    a.id,
    now()
FROM events e
JOIN LATERAL (
    SELECT id
    FROM artists
    ORDER BY random()
    LIMIT (1 + floor(random() * 2))::int
) a ON true
ON CONFLICT DO NOTHING;