-- DEV-1 step 3/11: profiles and platform_admins (BACKEND_SCHEMA §4.1-4.2).
-- No Auth trigger: the profile is created by the action that asks for the
-- first name (K30). RLS is enabled now (deny by default); policies and column
-- grants arrive in step 8 (§7.2).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 30),
  last_name text check (char_length(last_name) <= 50),
  email extensions.citext unique,
  is_guest boolean not null default true,
  tracking_consent_at timestamptz,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create table public.platform_admins (
  user_id uuid primary key references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
