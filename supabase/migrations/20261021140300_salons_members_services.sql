-- DEV-1 step 4/11: salons, specialties, salon_members, member_specialties,
-- opening_hours, salon_closures, services (BACKEND_SCHEMA §4.3-4.9).
-- RLS is enabled (deny by default); policies and column grants: step 8.

create extension if not exists btree_gist with schema extensions;

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+33[1-9][0-9]{8}$'),
  address_line text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  city text not null,
  city_code text,
  location extensions.geography(point, 4326) not null,
  siret char(14) not null check (siret ~ '^\d{14}$'),
  naf_code text,
  status public.salon_status not null default 'draft',
  queue_status public.queue_status not null default 'closed',
  welcome_message text check (char_length(welcome_message) <= 280),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  qr_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  reminder_after_minutes smallint not null default 5,
  auto_release_after_minutes smallint not null default 10,
  end_of_day_warning_minutes smallint not null default 120
    check (end_of_day_warning_minutes between 30 and 240),
  closing_grace_minutes smallint not null default 15,
  waiting_count integer not null default 0,
  current_wait_minutes integer,
  is_full boolean not null default false,
  estimate_updated_at timestamptz,
  next_free_slots jsonb not null default '[]',
  queue_version bigint not null default 0,
  setup_test_passed_at timestamptz,
  published_at timestamptz,
  draft_expires_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salons_reminder_before_release
    check (reminder_after_minutes < auto_release_after_minutes),
  constraint salons_next_free_slots_is_array
    check (jsonb_typeof(next_free_slots) = 'array')
);

create index salons_created_by_idx on public.salons (created_by);
create index salons_location_idx on public.salons using gist (location);
create index salons_draft_expires_at_idx on public.salons (draft_expires_at)
  where status = 'draft';

create trigger salons_set_updated_at
  before update on public.salons
  for each row execute function public.set_updated_at();

create table public.specialties (
  code text primary key,
  sort_order smallint not null
);

insert into public.specialties (code, sort_order) values
  ('women_cut', 1), ('men_cut', 2), ('kids_cut', 3), ('beard', 4), ('color', 5),
  ('highlights', 6), ('braids', 7), ('curly_hair', 8), ('styling', 9), ('treatment', 10);

create table public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  profile_id uuid references public.profiles (id),
  role public.member_role not null,
  status public.member_status not null default 'invited',
  first_name text not null check (char_length(first_name) between 1 and 30),
  last_name text not null,
  email extensions.citext not null,
  photo_path text,
  is_hairdressing boolean not null default true,
  served_today_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_members_salon_email_key unique (salon_id, email),
  constraint salon_members_active_has_profile
    check (status <> 'active' or profile_id is not null),
  constraint salon_members_stylist_always_hairdressing
    check (role <> 'stylist' or is_hairdressing)
);

create unique index salon_members_one_active_salon_per_stylist
  on public.salon_members (email)
  where role = 'stylist' and status <> 'deactivated';
create unique index salon_members_one_salon_per_manager
  on public.salon_members (profile_id)
  where role = 'manager';
create index salon_members_profile_id_idx on public.salon_members (profile_id);

create trigger salon_members_set_updated_at
  before update on public.salon_members
  for each row execute function public.set_updated_at();

create table public.member_specialties (
  member_id uuid not null references public.salon_members (id) on delete cascade,
  specialty_code text not null references public.specialties (code),
  primary key (member_id, specialty_code)
);

create index member_specialties_specialty_code_idx
  on public.member_specialties (specialty_code);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opening_hours_closes_after_opens check (closes_at > opens_at),
  constraint opening_hours_no_overlap exclude using gist (
    salon_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + opens_at, date '2000-01-01' + closes_at) with &&
  )
);

create trigger opening_hours_set_updated_at
  before update on public.opening_hours
  for each row execute function public.set_updated_at();

create table public.salon_closures (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text check (char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_closures_ends_after_starts check (ends_on >= starts_on)
);

create index salon_closures_salon_id_idx on public.salon_closures (salon_id, starts_on);

create trigger salon_closures_set_updated_at
  before update on public.salon_closures
  for each row execute function public.set_updated_at();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  duration_minutes smallint not null
    check (duration_minutes between 15 and 180 and duration_minutes % 5 = 0),
  price_cents integer not null check (price_cents >= 0),
  required_specialty_code text references public.specialties (code),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_salon_id_idx on public.services (salon_id);
create index services_required_specialty_code_idx on public.services (required_specialty_code);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.salons enable row level security;
alter table public.specialties enable row level security;
alter table public.salon_members enable row level security;
alter table public.member_specialties enable row level security;
alter table public.opening_hours enable row level security;
alter table public.salon_closures enable row level security;
alter table public.services enable row level security;
