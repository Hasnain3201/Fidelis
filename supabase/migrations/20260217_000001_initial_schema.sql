-- LIVEY initial schema for Supabase

create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'venue', 'artist', 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  display_name text,
  home_zip char(5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  address_line text,
  city text,
  state text,
  zip_code char(5) not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  stage_name text not null,
  genre text,
  bio text,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  zip_code char(5) not null,
  ticket_url text,
  is_promoted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_window check (end_time > start_time)
);

create table if not exists public.event_artists (
  event_id uuid not null references public.events(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, artist_id)
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.artist_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index if not exists idx_events_zip_start on public.events(zip_code, start_time);
create index if not exists idx_events_category on public.events(category);
create index if not exists idx_venues_zip on public.venues(zip_code);
create index if not exists idx_artists_genre on public.artists(genre);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger trg_venues_updated_at
before update on public.venues
for each row
execute function public.set_updated_at();

create trigger trg_artists_updated_at
before update on public.artists
for each row
execute function public.set_updated_at();

create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.artists enable row level security;
alter table public.events enable row level security;
alter table public.event_artists enable row level security;
alter table public.favorites enable row level security;
alter table public.artist_follows enable row level security;

create policy "profiles_select_public"
  on public.profiles
  for select
  using (true);

create policy "profiles_update_self"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "venues_select_public"
  on public.venues
  for select
  using (true);

create policy "venues_insert_owner"
  on public.venues
  for insert
  with check (auth.uid() = owner_id);

create policy "venues_update_owner"
  on public.venues
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "venues_delete_owner"
  on public.venues
  for delete
  using (auth.uid() = owner_id);

create policy "artists_select_public"
  on public.artists
  for select
  using (true);

create policy "artists_insert_owner"
  on public.artists
  for insert
  with check (auth.uid() = owner_id);

create policy "artists_update_owner"
  on public.artists
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "artists_delete_owner"
  on public.artists
  for delete
  using (auth.uid() = owner_id);

create policy "events_select_public"
  on public.events
  for select
  using (true);

create policy "events_insert_creator"
  on public.events
  for insert
  with check (auth.uid() = created_by);

create policy "events_update_creator"
  on public.events
  for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "events_delete_creator"
  on public.events
  for delete
  using (auth.uid() = created_by);

create policy "event_artists_select_public"
  on public.event_artists
  for select
  using (true);

create policy "event_artists_modify_event_creator"
  on public.event_artists
  for all
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.created_by = auth.uid()
    )
  );

create policy "favorites_select_self"
  on public.favorites
  for select
  using (auth.uid() = user_id);

create policy "favorites_insert_self"
  on public.favorites
  for insert
  with check (auth.uid() = user_id);

create policy "favorites_delete_self"
  on public.favorites
  for delete
  using (auth.uid() = user_id);

create policy "artist_follows_select_self"
  on public.artist_follows
  for select
  using (auth.uid() = user_id);

create policy "artist_follows_insert_self"
  on public.artist_follows
  for insert
  with check (auth.uid() = user_id);

create policy "artist_follows_delete_self"
  on public.artist_follows
  for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Auto-create a profile row whenever a new Supabase auth user is created.
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
