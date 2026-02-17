# Architecture (Initial)

## System

- `apps/web` (Next.js) renders guest discovery and role-specific dashboards.
- `apps/api` (FastAPI) owns validation, role checks, and business workflows.
- Supabase provides Postgres, Auth, and row-level security.

## Data Ownership

- Auth identity: Supabase `auth.users`
- User profile and role: `public.profiles`
- Venue data: `public.venues`
- Artist data: `public.artists`
- Discovery content: `public.events`, `public.event_artists`
- Engagement: `public.favorites`, `public.artist_follows`

## API Shape

- `GET /api/v1/events/search` for guest and registered discovery
- `POST /api/v1/venues/events` for venue publishing flow
- `POST /api/v1/users/favorites` for saved events
- `GET /api/v1/artists/mine` and `GET /api/v1/venues/mine` for role dashboards

## Security Direction

- Current code uses placeholder headers (`X-User-Id`, `X-User-Role`) for development speed.
- Replace this with Supabase JWT verification in API middleware.
- Keep RLS enabled in all user-facing tables to enforce ownership in DB.
