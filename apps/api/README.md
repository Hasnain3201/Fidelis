# fidelis-api

FastAPI backend for LIVEY.

## Setup

### 1) Install dependencies

```bash
pip3 install -r requirements.txt
```

### 2) Configure environment

Copy the example env file and set your Supabase credentials:

```bash
cp .env.example .env
```

Then edit `.env` and fill in:

- `SUPABASE_URL` – project URL from the Supabase dashboard (API settings).
- `SUPABASE_PUBLISHABLE_KEY` – publishable API key.
- `SUPABASE_SECRET_KEY` – secret API key (used server-side only).

You can also adjust:

- `APP_NAME` – label for the FastAPI docs.
- `ENVIRONMENT` – e.g. `development` or `production`.
- `API_PREFIX` – API base path (defaults to `/api/v1`).
- `CORS_ORIGINS` – comma-separated list of allowed frontend origins (e.g. `http://localhost:3000`).

These values are read by `app.core.config.Settings`.

### 3) Apply database schema in Supabase

The initial Postgres schema and RLS policies live in:

- `supabase/migrations/20260217_000001_initial_schema.sql`

To apply this schema to your Supabase project, either:

- Paste the file contents into the Supabase SQL editor and run it once, **or**
- Use the Supabase CLI pointed at your project and run the migration file.

After running the SQL, verify in the Supabase dashboard that the following tables exist with RLS enabled:

- `public.profiles`
- `public.venues`
- `public.artists`
- `public.events`
- `public.event_artists`
- `public.favorites`
- `public.artist_follows`

### 4) Seed mock data

An optional seed migration is provided at:

- `supabase/migrations/20260217_000002_seed_data.sql`

You can run this SQL (via the dashboard or CLI) to insert a small set of example profiles, venues, artists, and events. This makes the `/events/search` and `/events/{id}` endpoints return real data from Supabase.

### 5) Run the API

With dependencies installed, env configured, and the schema applied, start the FastAPI app:

```bash
uvicorn main:app --reload --port 8000
```

The OpenAPI docs will be available at `http://localhost:8000/docs`.
