-- DEV-8 part 3 (U-10, U-12): the client's ticket view also says whether
-- « Attendre » can still be offered (E7, E8) and what last moved his time
-- or his place, with its reason (E11, K26). Same function otherwise
-- (20261022090000).

create or replace function private.client_ticket_view(p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'salon_id', t.salon_id, 'service_date', t.service_date,
      'short_code', t.short_code, 'kind', t.kind, 'scheduled_at', t.scheduled_at,
      'display_name', t.display_name, 'status', t.status, 'channel', t.channel,
      'service_name', sv.name, 'planned_duration_minutes', t.planned_duration_minutes,
      'requested_stylist_first_name', rq.first_name,
      'assigned_stylist_first_name', asg.first_name,
      'estimated_start_at', t.estimated_start_at,
      'last_notified_start_at', t.last_notified_start_at,
      'eta_response', t.eta_response, 'declared_delay_minutes', t.declared_delay_minutes,
      'declared_arrival_at', t.declared_arrival_at,
      'turn_approaching_sent_at', t.turn_approaching_sent_at,
      'arrived_at', t.arrived_at, 'called_at', t.called_at,
      'release_due_at', t.release_due_at, 'call_count', t.call_count,
      'started_at', t.started_at, 'completed_at', t.completed_at,
      'cancelled_at', t.cancelled_at, 'cancel_reason', t.cancel_reason,
      'removal_reason', t.removal_reason, 'no_show_at', t.no_show_at,
      'notifications_consent', t.notifications_consent_at is not null,
      'stylist_change_pending_since', t.stylist_change_pending_since,
      'reassignment_stylist_first_name', ra.first_name,
      'reassignment_requested_at', t.reassignment_requested_at,
      'reassignment_proposed_start_at', t.reassignment_proposed_start_at,
      'end_of_day_warned_at', t.end_of_day_warned_at,
      'end_of_day_choice', t.end_of_day_choice,
      -- E7, E8: « Attendre » only while the requested stylist still cuts hair today.
      'wait_offered', rq.status = 'active' and rq.is_hairdressing
        and coalesce(rqp.status::text, 'offline') <> 'absent',
      -- U-10 (E11, K26): the last change of time or place, with its reason.
      -- An estimate back within 10 min of the time it left is no longer explained.
      'last_change', (select jsonb_build_object('type', l.type, 'reason', l.reason_code, 'at', l.created_at)
        from (select e.type, e.reason_code, e.created_at, e.before
              from public.ticket_events e
              where e.ticket_id = t.id and e.type in ('estimate_changed', 'postponed')
              order by e.created_at desc, e.id desc limit 1) l
        where l.type = 'postponed'
           or (t.estimated_start_at is not null
               and (l.before ->> 'start_at' is null
                    or abs(extract(epoch from t.estimated_start_at - (l.before ->> 'start_at')::timestamptz)) >= 600))),
      -- E13, as the engine's positionOf: his stylist's called client and the
      -- earlier estimates at that stylist; none without a stylist or a time,
      -- and none for an appointment.
      'position', case
        when t.status = 'waiting' and t.kind = 'queue'
         and t.estimated_member_id is not null and t.estimated_start_at is not null then (
        select count(*)::int from public.tickets o
        where o.salon_id = t.salon_id and o.service_date = t.service_date and o.id <> t.id
          and ((o.status = 'called' and o.assigned_member_id = t.estimated_member_id)
            or (o.status = 'waiting' and o.estimated_member_id = t.estimated_member_id
                and o.estimated_start_at < t.estimated_start_at))) end),
    'salon', jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'address_line', s.address_line,
      'postal_code', s.postal_code, 'city', s.city,
      'latitude', extensions.st_y(s.location::extensions.geometry),
      'longitude', extensions.st_x(s.location::extensions.geometry),
      'queue_status', s.queue_status, 'estimate_updated_at', s.estimate_updated_at))
  from public.tickets t
  join public.salons s on s.id = t.salon_id
  left join public.services sv on sv.id = t.service_id
  left join public.salon_members rq on rq.id = t.requested_member_id
  left join public.stylist_presence rqp on rqp.member_id = t.requested_member_id
    and rqp.service_date = t.service_date
  left join public.salon_members asg on asg.id = t.assigned_member_id
  left join public.salon_members ra on ra.id = t.reassignment_member_id
  where t.id = p_ticket_id and not t.is_test;
$$;
