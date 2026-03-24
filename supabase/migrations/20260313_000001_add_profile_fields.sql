alter table public.profiles
add column if not exists username text unique;

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists city text;

alter table public.profiles
add column if not exists state text;

drop table if exists public.users cascade;