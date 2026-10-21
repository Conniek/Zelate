-- DEV-1 step 6/11: tickets, ticket_events, salon_events, notifications,
-- push_subscriptions, salon_verifications (BACKEND_SCHEMA §4.13-4.18).
-- RLS is enabled (deny by default); policies: step 8.

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id),
  service_date date not null,
  short_code text not null check (short_code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  tracking_token text not null unique,
  tracking_short_code text not null unique check (tracking_short_code ~ '^[A-Za-z0-9]{8}$'),
  kind public.ticket_kind not null default 'queue',
  scheduled_at timestamptz,
  appointment_source public.appointment_source,
  confirmed_at timestamptz,
  confirmed_by_member_id uuid references public.salon_members (id),
  confirmation_reminder_sent_at timestamptz,
  appointment_delay_warned_steps smallint not null default 0,
  client_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) <= 30),
  channel public.ticket_channel not null,
  is_test boolean not null default false,
  service_id uuid references public.services (id),
  planned_duration_minutes smallint not null check (planned_duration_minutes between 5 and 240),
  requested_member_id uuid references public.salon_members (id),
  estimated_member_id uuid references public.salon_members (id),
  assigned_member_id uuid references public.salon_members (id),
  status public.ticket_status not null default 'waiting',
  queue_rank integer not null,
  priority_since timestamptz,
  call_count smallint not null default 0 check (call_count >= 0),
  postpone_count smallint not null default 0 check (postpone_count between 0 and 2),
  declared_arrival_at timestamptz,
  notifications_consent_at timestamptz,
  eta_response public.eta_response,
  declared_delay_minutes smallint check (declared_delay_minutes between 5 and 30),
  arrived_at timestamptz,
  stylist_change_pending_since timestamptz,
  reassignment_member_id uuid references public.salon_members (id),
  reassignment_requested_at timestamptz,
  reassignment_proposed_start_at timestamptz,
  estimated_start_at timestamptz,
  last_notified_start_at timestamptz,
  initial_estimated_start_at timestamptz,
  t30_estimated_start_at timestamptz,
  estimate_version integer not null default 0,
  turn_approaching_sent_at timestamptz,
  get_ready_sent_at timestamptz,
  called_at timestamptz,
  release_due_at timestamptz,
  reminder_sent_at timestamptz,
  end_of_day_warned_at timestamptz,
  end_of_day_choice public.end_of_day_choice,
  closing_decision public.closing_decision,
  started_at timestamptz,
  completed_at timestamptz,
  actual_duration_minutes smallint,
  cancelled_at timestamptz,
  cancel_reason public.cancel_reason,
  removal_reason public.removal_reason,
  removal_note text check (char_length(removal_note) <= 200),
  no_show_at timestamptz,
  created_by_member_id uuid references public.salon_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tickets_salon_date_short_code_key unique (salon_id, service_date, short_code),
  constraint tickets_appointment_fields check (
    (kind = 'appointment') = (scheduled_at is not null and appointment_source is not null)
  ),
  -- A cancelled or pending appointment may still have no stylist (rejected request).
  constraint tickets_appointment_has_stylist check (
    kind <> 'appointment'
    or status in ('pending_confirmation', 'cancelled')
    or assigned_member_id is not null
  ),
  constraint tickets_called_has_called_at check (status <> 'called' or called_at is not null),
  constraint tickets_in_service_has_started_at check (status <> 'in_service' or started_at is not null),
  constraint tickets_completed_has_completed_at check (status <> 'completed' or completed_at is not null),
  constraint tickets_cancelled_has_reason check (
    status <> 'cancelled' or (cancelled_at is not null and cancel_reason is not null)
  ),
  constraint tickets_no_show_has_no_show_at check (status <> 'no_show' or no_show_at is not null),
  constraint tickets_active_has_stylist check (
    status not in ('called', 'in_service', 'completed') or assigned_member_id is not null
  ),
  constraint tickets_in_service_has_arrived check (status <> 'in_service' or arrived_at is not null),
  constraint tickets_pending_is_client_check_in check (
    status <> 'pending_confirmation' or appointment_source = 'client_check_in'
  ),
  constraint tickets_check_in_confirmed check (
    appointment_source is distinct from 'client_check_in'
    or status not in ('waiting', 'called', 'in_service', 'completed', 'no_show')
    or confirmed_at is not null
  ),
  constraint tickets_eta_matches_delay check (
    coalesce(eta_response = 'late', false) = (declared_delay_minutes is not null)
  ),
  constraint tickets_reassignment_all_or_none check (
    (reassignment_member_id is null) = (reassignment_requested_at is null)
    and (reassignment_member_id is null) = (reassignment_proposed_start_at is null)
  ),
  constraint tickets_removal_reason_required check (
    cancel_reason is null
    or cancel_reason not in ('removed_by_salon', 'appointment_rejected')
    or removal_reason is not null
  ),
  constraint tickets_call_fields_only_when_called check (
    status = 'called'
    or (called_at is null and reminder_sent_at is null and release_due_at is null)
  )
);

-- One active ticket per client; one called/in-service ticket per stylist.
create unique index tickets_one_active_per_client
  on public.tickets (client_id)
  where status in ('pending_confirmation', 'waiting', 'called', 'in_service') and not is_test;
create unique index tickets_one_busy_per_stylist
  on public.tickets (assigned_member_id)
  where status in ('called', 'in_service');

create index tickets_salon_date_status_idx on public.tickets (salon_id, service_date, status);
create index tickets_assigned_status_idx on public.tickets (assigned_member_id, status);
create index tickets_client_created_idx on public.tickets (client_id, created_at desc);
create index tickets_appointments_idx on public.tickets (salon_id, service_date, scheduled_at)
  where kind = 'appointment';
create index tickets_service_id_idx on public.tickets (service_id);
create index tickets_requested_member_idx on public.tickets (requested_member_id);
create index tickets_estimated_member_idx on public.tickets (estimated_member_id);
create index tickets_reassignment_member_idx on public.tickets (reassignment_member_id);
create index tickets_confirmed_by_idx on public.tickets (confirmed_by_member_id);
create index tickets_created_by_member_idx on public.tickets (created_by_member_id);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- Append-only audit logs. No free text, phone, token or first name (K10).
create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id),
  salon_id uuid not null references public.salons (id),
  type public.ticket_event_type not null,
  actor_type public.actor_type not null,
  actor_member_id uuid references public.salon_members (id),
  actor_profile_id uuid, -- no foreign key on purpose (K29)
  reason_code text check (reason_code ~ '^[a-z_]+$'),
  before jsonb,
  after jsonb,
  command_id uuid,
  created_at timestamptz not null default now()
);

create index ticket_events_salon_created_idx on public.ticket_events (salon_id, created_at desc);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, id);
create index ticket_events_actor_member_idx on public.ticket_events (actor_member_id);

create trigger ticket_events_append_only
  before update or delete on public.ticket_events
  for each row execute function public.prevent_update_delete();

create table public.salon_events (
  id bigint generated always as identity primary key,
  salon_id uuid not null references public.salons (id),
  type public.salon_event_type not null,
  actor_type public.actor_type not null,
  actor_member_id uuid references public.salon_members (id),
  actor_profile_id uuid, -- no foreign key on purpose (K29)
  subject_member_id uuid references public.salon_members (id),
  ticket_id uuid references public.tickets (id),
  reason_code text check (reason_code ~ '^[a-z_]+$'),
  before jsonb,
  after jsonb,
  command_id uuid,
  created_at timestamptz not null default now()
);

create index salon_events_salon_created_idx on public.salon_events (salon_id, created_at desc);
create index salon_events_actor_member_idx on public.salon_events (actor_member_id);
create index salon_events_subject_member_idx on public.salon_events (subject_member_id);
create index salon_events_ticket_idx on public.salon_events (ticket_id);

create trigger salon_events_append_only
  before update or delete on public.salon_events
  for each row execute function public.prevent_update_delete();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets (id),
  salon_id uuid not null references public.salons (id),
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  recipient_member_id uuid references public.salon_members (id),
  channel public.notification_channel not null,
  template public.notification_template not null,
  params jsonb not null default '{}',
  dedupe_key text not null,
  status public.notification_status not null default 'pending',
  skip_reason text,
  provider_message_id text,
  cost_cents integer,
  attempts smallint not null default 0 check (attempts between 0 and 3),
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_with_ticket
  on public.notifications (ticket_id, channel, dedupe_key)
  where ticket_id is not null;
create unique index notifications_dedupe_without_ticket
  on public.notifications (salon_id, channel, dedupe_key)
  where ticket_id is null;
create index notifications_pending_idx on public.notifications (scheduled_at)
  where status = 'pending';
create index notifications_salon_idx on public.notifications (salon_id);
create index notifications_recipient_profile_idx on public.notifications (recipient_profile_id);
create index notifications_recipient_member_idx on public.notifications (recipient_member_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete cascade,
  member_id uuid references public.salon_members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  expired_at timestamptz,
  constraint push_subscriptions_exactly_one_owner check (
    num_nonnulls(profile_id, ticket_id, member_id) = 1
  )
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);
create index push_subscriptions_ticket_idx on public.push_subscriptions (ticket_id);
create index push_subscriptions_member_idx on public.push_subscriptions (member_id);

create table public.salon_verifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  siret_check_result public.siret_check_result not null,
  siret_check_payload jsonb,
  checked_at timestamptz not null,
  decision public.verification_decision not null default 'pending',
  decision_reason text,
  decided_by uuid references public.platform_admins (user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint salon_verifications_rejection_has_reason check (
    decision <> 'rejected' or decision_reason is not null
  )
);

create index salon_verifications_salon_idx on public.salon_verifications (salon_id);
create index salon_verifications_decided_by_idx on public.salon_verifications (decided_by);

alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.salon_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.salon_verifications enable row level security;
