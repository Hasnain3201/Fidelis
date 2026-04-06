alter table public.profiles
add column if not exists email_opt_in boolean;

alter table public.profiles
add column if not exists sms_opt_in boolean;

update public.profiles
set
  email_opt_in = coalesce(email_opt_in, false),
  sms_opt_in = coalesce(sms_opt_in, false)
where email_opt_in is null
   or sms_opt_in is null;

alter table public.profiles
alter column email_opt_in set default false;

alter table public.profiles
alter column sms_opt_in set default false;

alter table public.profiles
alter column email_opt_in set not null;

alter table public.profiles
alter column sms_opt_in set not null;
