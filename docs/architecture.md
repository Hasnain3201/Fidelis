# Architecture

## System

- `apps/web` (Next.js) renders guest discovery and role-specific dashboards.
- `apps/api` (FastAPI) owns validation, role checks, managed-profile enforcement, and business workflows.
- Supabase provides Postgres, Auth, and row-level security.

## Data Ownership

- Auth identity: Supabase `auth.users`
- User profile and role: `public.profiles`
- Venue data: `public.venues`
- Artist data: `public.artists`
- Ownership claims: `public.venue_claims`, `public.artist_claims`
- Discovery content: `public.events`, `public.event_artists`
- Engagement: `public.favorites`, `public.artist_follows`

## API Shape

- `GET  /api/v1/events/search`   — guest and registered discovery
- `GET  /api/v1/events/{id}`     — event detail (public)
- `GET  /api/v1/users/me`        — authenticated user profile
- `PATCH /api/v1/users/me`       — update profile
- `POST /api/v1/users/favorites` — save event (role: user)
- `POST /api/v1/users/follows`   — follow artist (role: user)
- `POST /api/v1/venues/mine`     — create venue and link it to caller account (role: venue)
- `PATCH /api/v1/venues/mine`    — update managed venue (role: venue + managed link)
- `POST /api/v1/venues/events`   — publish event (role: venue + managed link)
- `POST /api/v1/artists/mine`    — create artist and link it to caller account (role: artist)
- `PATCH /api/v1/artists/mine`   — update managed artist (role: artist + managed link)
- `POST /api/v1/claims/venue-claims`  — submit venue claim (role: venue)
- `POST /api/v1/claims/artist-claims` — submit artist claim (role: artist)
- `GET  /api/v1/claims/mine`     — list own claims (any authenticated)
- `PATCH /api/v1/claims/venue-claims/{id}/review`  — admin review
- `PATCH /api/v1/claims/artist-claims/{id}/review`  — admin review

## Security

- Supabase JWT is verified on every authenticated request via JWKS (issuer + expiration enforced).
- Role enforcement uses the `profiles.role` column as the trusted source with JWT metadata fallback.
- **Managed ownership**: venues and artists are resolved from owner links first, then claim links, so existing accounts keep one persistent managed profile.
- RLS is enabled on all user-facing tables; venue/artist writes are claim-scoped, most reads are public.
- The API creates a per-request Supabase client carrying the caller's JWT so RLS `auth.uid()` resolves correctly.
- Venue/artist creation uses the admin client (service role) to insert the entity and ensure linkage to the creator account.
- Claim review is admin-only: regular users cannot approve or reject claims.
- See `docs/auth.md` for the full frontend auth contract and endpoint access matrix.
