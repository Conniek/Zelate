-- E17, E36: the engine decides per notification whether the ticket's
-- « Me prévenir » consent is required; send-notifications only applies it.
alter table public.notifications
  add column requires_consent boolean not null default false;

comment on column public.notifications.requires_consent is
  'Computed by the queue engine: true for anticipation messages (turn_approaching, get_ready, estimate_changed, end_of_day_risk) except the estimate_changed of a requeued called client (E36).';
