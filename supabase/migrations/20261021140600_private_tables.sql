-- DEV-1 step 7/11: tables of the private schema (BACKEND_SCHEMA §5).
-- Never exposed by the API: only the service role and security definer
-- functions reach them. RLS is enabled as a second barrier.

create table private.ticket_contacts (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  phone_hash bytea not null,
  is_active boolean not null,
  is_pending_confirmation boolean not null default false,
  closed_at timestamptz
);

-- One active ticket per phone number, without blocking the check-in of an
-- appointment already entered by the salon (K14, K28).
create unique index ticket_contacts_one_active_per_phone
  on private.ticket_contacts (phone_hash)
  where is_active and not is_pending_confirmation;
create index ticket_contacts_closed_at_idx on private.ticket_contacts (closed_at)
  where closed_at is not null;

create table private.member_invitations (
  member_id uuid primary key references public.salon_members (id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table private.processed_commands (
  command_id uuid primary key,
  command text not null,
  salon_id uuid,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create index processed_commands_created_at_idx on private.processed_commands (created_at);

create table private.rate_limits (
  bucket text not null,
  key_hash bytea not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (bucket, key_hash, window_start)
);

create index rate_limits_window_start_idx on private.rate_limits (window_start);

create table private.no_show_records (
  phone_hash bytea not null,
  ticket_id uuid not null,
  occurred_at timestamptz not null,
  primary key (phone_hash, ticket_id)
);

create index no_show_records_occurred_at_idx on private.no_show_records (occurred_at);

create table private.no_show_warnings (
  phone_hash bytea primary key,
  warned_at timestamptz not null
);

create index no_show_warnings_warned_at_idx on private.no_show_warnings (warned_at);

alter table private.ticket_contacts enable row level security;
alter table private.member_invitations enable row level security;
alter table private.processed_commands enable row level security;
alter table private.rate_limits enable row level security;
alter table private.no_show_records enable row level security;
alter table private.no_show_warnings enable row level security;

-- Defence in depth: the API roles hold no right on these tables.
revoke all on all tables in schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
