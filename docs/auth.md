# Authentication & Authorization

## Token Flow

1. The frontend authenticates with Supabase Auth directly (email/password via `/auth/v1/token`).
2. Supabase returns a JWT access token containing the user's `sub` (user id) and `user_metadata`.
3. The frontend stores the session locally and attaches the token to every API request.
4. The API verifies the JWT using Supabase JWKS, extracts the user id, and resolves the role from the `profiles` table.

## Required Headers

| Header          | Value                              | When              |
|-----------------|------------------------------------|-------------------|
| `Authorization` | `Bearer <supabase_access_token>`   | All auth requests |
| `Content-Type`  | `application/json`                 | POST / PATCH      |

### Legacy Headers (no longer required)

`X-User-Id` and `X-User-Role` were used during early development. The API now derives identity and role entirely from the JWT. These headers are ignored by the backend and can be removed from frontend code.

## Account Roles

| Role     | Description                        | Persisted |
|----------|------------------------------------|-----------|
| `guest`  | Unauthenticated visitor            | No        |
| `user`   | Registered user (favorites/follows)| Yes       |
| `venue`  | Venue manager (events/venue profile)| Yes      |
| `artist` | Artist (artist profile management) | Yes       |
| `admin`  | Administrator (bypasses all roles) | Yes       |

The role is stored in `profiles.role` (Postgres enum: `user_role`). `guest` is not a database role; it simply means the caller did not provide a valid JWT.

## Claims-Based Ownership

Venues and artists can exist in the database before any account owner is known. When a user wants to manage a venue or artist, they submit a **claim** which must be approved by an admin before management access is granted.

### Claim Lifecycle

```
pending  ──(admin approves)──>  approved  ──>  user can manage entity
         ──(admin rejects)───>  rejected  ──>  user cannot manage entity
```

### Authorization Model

Write access to venues and artists requires **both**:
1. The correct role (`venue` or `artist`)
2. An **approved claim** linking the user to the specific entity

Creating a new venue/artist via the API auto-approves the claim for the creator.

### Claim Tables

- `venue_claims` — links `profiles.id` to `venues.id` with a `claim_status` enum
- `artist_claims` — links `profiles.id` to `artists.id` with a `claim_status` enum

Each claim row includes `reviewed_by` and `reviewed_at` for audit.

## Endpoint Access Matrix

| Endpoint                                     | Method | Auth     | Role    | Claim Required |
|----------------------------------------------|--------|----------|---------|----------------|
| `/api/v1/health/`                            | GET    | None     | —       | —              |
| `/api/v1/events/search`                      | GET    | None     | —       | —              |
| `/api/v1/events/{id}`                        | GET    | None     | —       | —              |
| `/api/v1/auth/signup`                        | POST   | None     | —       | —              |
| `/api/v1/auth/me`                            | GET    | Required | any     | —              |
| `/api/v1/users/me`                           | GET    | Required | any     | —              |
| `/api/v1/users/me`                           | PATCH  | Required | any     | —              |
| `/api/v1/users/favorites`                    | GET    | Required | user    | —              |
| `/api/v1/users/favorites`                    | POST   | Required | user    | —              |
| `/api/v1/users/favorites/{eid}`              | DELETE | Required | user    | —              |
| `/api/v1/users/follows`                      | GET    | Required | user    | —              |
| `/api/v1/users/follows`                      | POST   | Required | user    | —              |
| `/api/v1/users/follows/{aid}`                | DELETE | Required | user    | —              |
| `/api/v1/venues/mine`                        | GET    | Required | venue   | Approved       |
| `/api/v1/venues/mine`                        | POST   | Required | venue   | Auto-approved  |
| `/api/v1/venues/mine`                        | PATCH  | Required | venue   | Approved       |
| `/api/v1/venues/events`                      | POST   | Required | venue   | Approved       |
| `/api/v1/artists/mine`                       | GET    | Required | artist  | Approved       |
| `/api/v1/artists/mine`                       | POST   | Required | artist  | Auto-approved  |
| `/api/v1/artists/mine`                       | PATCH  | Required | artist  | Approved       |
| `/api/v1/claims/venue-claims`                | POST   | Required | venue   | —              |
| `/api/v1/claims/artist-claims`               | POST   | Required | artist  | —              |
| `/api/v1/claims/mine`                        | GET    | Required | any     | —              |
| `/api/v1/claims/venue-claims/{id}/review`    | PATCH  | Required | admin   | —              |
| `/api/v1/claims/artist-claims/{id}/review`   | PATCH  | Required | admin   | —              |

## Error Responses

| Status | Meaning                                             |
|--------|-----------------------------------------------------|
| 401    | Missing or invalid/expired JWT                      |
| 403    | Valid JWT but insufficient role **or** no approved claim |
| 404    | Resource not found or not managed by caller          |
| 409    | Claim already exists for this user/entity pair       |

## Row-Level Security (RLS)

All user-facing tables have RLS enabled. The API forwards the caller's JWT to Supabase so `auth.uid()` resolves to the caller in every query.

- **Reads**: profiles, venues, artists, events, and event_artists are publicly readable. Favorites, artist_follows, and claims are self-only.
- **Venue/artist writes**: require an approved claim (RLS checks `venue_claims`/`artist_claims` for `auth.uid()` with status `approved`).
- **Event writes**: scoped to `created_by = auth.uid()`.
- **Claim inserts**: users can only insert pending claims for themselves.
- **Claim reviews**: admin-only via service role (bypasses RLS).
- **Admin client**: used for signup provisioning, venue/artist creation with auto-claim, and claim review. Bypasses RLS intentionally.
