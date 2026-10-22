-- DEV-8 (F-C5, F-C10, U-06): one view of a ticket for its client, read the same
-- way with a session (`my_ticket`) or with the SMS link (`ticket-public`).
-- It carries what the tracking screen shows: position at the client's stylist
-- (E13), times, the call countdown, the pending requests (choice of stylist,
-- reassignment, end of day) and how the ticket ended. Never a phone number,
-- never the tracking token (ADR-006, H6).

create function private.client_ticket_view(p_ticket_id uuid)
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
      -- E13: clients before him at his stylist; no position for an appointment.
      'position', case when t.status = 'waiting' and t.kind = 'queue' then (
        select count(*)::int from public.tickets o
        where o.salon_id = t.salon_id and o.service_date = t.service_date
          and o.status = 'waiting' and o.id <> t.id
          and coalesce(o.assigned_member_id, o.estimated_member_id)
              is not distinct from coalesce(t.assigned_member_id, t.estimated_member_id)
          and o.estimated_start_at < t.estimated_start_at) end),
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
  left join public.salon_members asg on asg.id = t.assigned_member_id
  left join public.salon_members ra on ra.id = t.reassignment_member_id
  where t.id = p_ticket_id and not t.is_test;
$$;

revoke execute on function private.client_ticket_view(uuid) from public, anon, authenticated;

-- The signed-in client's ticket of today: the active one, else the last one
-- that ended today (to show how it ended, F-C5).
create function public.my_ticket()
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.client_ticket_view(t.id)
  from public.tickets t
  where t.client_id = (select auth.uid())
    and t.service_date = (now() at time zone 'Europe/Paris')::date
    and not t.is_test
  order by (t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')) desc,
           t.updated_at desc
  limit 1;
$$;

revoke execute on function public.my_ticket() from public, anon, authenticated;
grant execute on function public.my_ticket() to authenticated;
