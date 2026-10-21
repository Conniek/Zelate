-- DEV-1 step 5/11: stylist_presence (BACKEND_SCHEMA §4.12).
create table public.stylist_presence (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  member_id uuid not null references public.salon_members (id) on delete cascade,
  service_date date not null,
  status public.presence_status not null default 'offline',
  status_since timestamptz not null,
  break_type public.break_type,
  expected_back_at timestamptz,
  shift_end_at timestamptz,
  updated_by_member_id uuid references public.salon_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stylist_presence_member_date_key unique (member_id, service_date)
);

create index stylist_presence_salon_date_idx on public.stylist_presence (salon_id, service_date);
create index stylist_presence_updated_by_idx on public.stylist_presence (updated_by_member_id);

create trigger stylist_presence_set_updated_at
  before update on public.stylist_presence
  for each row execute function public.set_updated_at();

alter table public.stylist_presence enable row level security;
