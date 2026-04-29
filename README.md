# Fidelis (LIVEY)

LIVEY project Repo

## Stack

- Frontend: Next.js (TypeScript, App Router)
- Backend: FastAPI (Python)
- Database/Auth: Supabase (Postgres + Auth + RLS)

## Repository Layout

- `apps/web`: Next.js frontend
- `apps/api`: FastAPI backend
- `packages/shared`: shared TypeScript contracts
- `supabase/migrations`: SQL schema + RLS policies
- `docs`: architecture and roadmap docs

## Prerequisites

- Node.js 20+ (tested with Node 24)
- npm 10+
- Python 3.9+

## Quick Start

### 1) Install web dependencies

```bash
npm install --workspace @fidelis/web
```

### 2) Install API dependencies

```bash
pip3 install -r apps/api/requirements.txt
```

### 3) Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Set your Supabase URL + keys in `apps/api/.env` and your API URL in `apps/web/.env.local`.

### 4) Run services

Terminal 1:

```bash
npm run dev:web
```

Terminal 2:

```bash
npm run dev:api
```

- Web: `http://localhost:3000`
- API docs: `https://fidelisappsapi-production.up.railway.app/docs`
