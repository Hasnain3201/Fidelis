-- LIVEY seed data for local development
-- This inserts a small set of profiles, venues, artists, and events
-- so that the FastAPI endpoints can return real data from Supabase.

-- Seed profiles (event creators / owners)
insert into public.profiles (id, role, display_name, home_zip)
values
  ('10a2f538-f432-48a0-b901-505fefc01e5c', 'venue', 'Harbor House Owner', '10001'),
  ('3e27379b-04d5-4a9c-a742-3a08848f16c3', 'venue', 'Brick Room Owner', '10001'),
  ('8f916a46-3763-4228-b161-2444d3396742', 'venue', 'Metro Arts Owner', '10001'),
  ('58296c63-6bf3-4137-9f96-592d9b5b8ba1', 'venue', 'Central Plaza Manager', '10001')
on conflict (id) do nothing;

-- Seed venues
insert into public.venues (id, owner_id, name, description, address_line, city, state, zip_code, verified)
values
  ('10000000-0000-0000-0000-000000000001',
   '10a2f538-f432-48a0-b901-505fefc01e5c',
   'Harbor House',
   'Cozy waterfront venue with regular live music.',
   '1 Harbor Way',
   'New York',
   'NY',
   '10001',
   true),
  ('10000000-0000-0000-0000-000000000002',
   '3e27379b-04d5-4a9c-a742-3a08848f16c3',
   'Brick Room',
   'Intimate basement room for comedy and small shows.',
   '22 Brick St',
   'New York',
   'NY',
   '10001',
   false),
  ('10000000-0000-0000-0000-000000000003',
   '8f916a46-3763-4228-b161-2444d3396742',
   'Metro Arts Co-op',
   'Artist-run gallery and performance space.',
   '75 Market Ave',
   'New York',
   'NY',
   '10001',
   true),
  ('10000000-0000-0000-0000-000000000004',
   '58296c63-6bf3-4137-9f96-592d9b5b8ba1',
   'Central Plaza',
   'Outdoor plaza for large seasonal festivals.',
   '100 Central Plaza',
   'New York',
   'NY',
   '10001',
   true)
on conflict (id) do nothing;

-- Seed artists
insert into public.artists (id, owner_id, stage_name, genre, bio, media_url)
values
  ('20000000-0000-0000-0000-000000000001',
   '10a2f538-f432-48a0-b901-505fefc01e5c',
   'Harbor Jazz Trio',
   'live-music',
   'Local jazz trio playing standards and modern arrangements.',
   null),
  ('20000000-0000-0000-0000-000000000002',
   '3e27379b-04d5-4a9c-a742-3a08848f16c3',
   'Brick City Comics',
   'comedy',
   'Rotating lineup of stand-up comics.',
   null),
  ('20000000-0000-0000-0000-000000000003',
   '8f916a46-3763-4228-b161-2444d3396742',
   'Metro Arts Collective',
   'arts',
   'Interdisciplinary group of visual and performance artists.',
   null)
on conflict (id) do nothing;

-- Seed events (all in zip 10001 with future start times)
insert into public.events
  (id, venue_id, created_by, title, description, category, start_time, end_time, zip_code, ticket_url, is_promoted)
values
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '10a2f538-f432-48a0-b901-505fefc01e5c',
   'Live Jazz Night',
   'Evening of jazz standards at the waterfront.',
   'live-music',
   '2026-03-01T20:00:00+00:00',
   '2026-03-01T23:00:00+00:00',
   '10001',
   null,
   false),
  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   '3e27379b-04d5-4a9c-a742-3a08848f16c3',
   'Stand-Up Open Mic',
   'Weekly open mic featuring up-and-coming comics.',
   'comedy',
   '2026-03-03T00:00:00+00:00',
   '2026-03-03T02:00:00+00:00',
   '10001',
   null,
   false),
  ('30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003',
   '8f916a46-3763-4228-b161-2444d3396742',
   'Downtown Art Walk',
   'Gallery crawl featuring local artists and installations.',
   'arts',
   '2026-03-06T22:00:00+00:00',
   '2026-03-07T01:00:00+00:00',
   '10001',
   null,
   true),
  ('30000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000001',
   '10a2f538-f432-48a0-b901-505fefc01e5c',
   'Acoustic Songwriter Night',
   'Songwriter showcase with stripped-down sets.',
   'live-music',
   '2026-03-14T19:00:00+00:00',
   '2026-03-14T22:00:00+00:00',
   '10001',
   null,
   false),
  ('30000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000004',
   '58296c63-6bf3-4137-9f96-592d9b5b8ba1',
   'Spring Beer Festival',
   'Seasonal outdoor beer festival with live music.',
   'festival',
   '2026-04-02T18:00:00+00:00',
   '2026-04-02T23:00:00+00:00',
   '10001',
   null,
   true)
on conflict (id) do nothing;

-- Link artists to events
insert into public.event_artists (event_id, artist_id)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001')
on conflict (event_id, artist_id) do nothing;

