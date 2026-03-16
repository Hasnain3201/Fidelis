-- =============================================
-- Seed events for all venues
-- =============================================

INSERT INTO events (
    id,
    venue_id,
    title,
    description,
    category,
    start_time,
    end_time,
    zip_code,
    ticket_url,
    is_promoted,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    v.id,
    'Live Event at ' || v.name,
    'Special live event hosted at ' || v.name,
    'music',
    start_time,
    start_time + interval '2 hours',
    v.zip_code,
    'https://tickets.livey.com/' || floor(random()*10000),
    false,
    now(),
    now()
FROM (
    SELECT
        id,
        name,
        zip_code,
        NOW() + (random() * interval '30 days') AS start_time
    FROM venues
) v;