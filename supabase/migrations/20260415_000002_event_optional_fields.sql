-- Optional event publishing fields used by the venue create-event form.
alter table public.events
  add column if not exists price numeric,
  add column if not exists age_requirement text,
  add column if not exists capacity integer;
