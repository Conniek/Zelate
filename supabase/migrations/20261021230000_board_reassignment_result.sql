-- S-13 (E27): the board shows the client's answer to a reassignment request.
-- The engine writes it as the `reason_code` of the `reassignment_resolved`
-- event (`accepted`, `refused`, `expired`); `after` is never filled, so the
-- board read null. Same function otherwise (20261021220000).

create or replace function public.get_salon_board(salon_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_closing timestamptz;
  v_result jsonb;
begin
  if salon_id is distinct from private.managed_salon_id() then
    raise exception 'not the manager of this salon' using errcode = '42501';
  end if;

  -- F-M12: the last closing of today, in Paris; none on a closure day (H9).
  select case
      when exists (select 1 from public.salon_closures c
                   where c.salon_id = get_salon_board.salon_id
                     and v_today between c.starts_on and c.ends_on) then null
      else (select (v_today + max(o.closes_at)) at time zone 'Europe/Paris'
            from public.opening_hours o
            where o.salon_id = get_salon_board.salon_id
              and o.weekday = extract(isodow from v_today)::smallint)
    end
    into v_closing;

  select jsonb_build_object(
    'stylists', coalesce((select jsonb_agg(jsonb_build_object(
        'member_id', m.id, 'first_name', m.first_name, 'photo_path', m.photo_path,
        'role', m.role, 'is_hairdressing', m.is_hairdressing,
        'status', p.status, 'status_since', p.status_since, 'break_type', p.break_type,
        'expected_back_at', p.expected_back_at, 'shift_end_at', p.shift_end_at,
        'served_today_count', m.served_today_count) order by m.first_name)
      from public.salon_members m
      left join public.stylist_presence p on p.member_id = m.id and p.service_date = v_today
      where m.salon_id = get_salon_board.salon_id and m.status = 'active'), '[]'),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'short_code', t.short_code, 'display_name', t.display_name, 'kind', t.kind,
        'scheduled_at', t.scheduled_at, 'status', t.status, 'queue_rank', t.queue_rank,
        'service_id', t.service_id, 'planned_duration_minutes', t.planned_duration_minutes,
        'requested_member_id', t.requested_member_id, 'estimated_member_id', t.estimated_member_id,
        'assigned_member_id', t.assigned_member_id, 'estimated_start_at', t.estimated_start_at,
        'eta_response', t.eta_response, 'declared_delay_minutes', t.declared_delay_minutes,
        'arrived_at', t.arrived_at, 'called_at', t.called_at, 'started_at', t.started_at,
        'stylist_change_pending_since', t.stylist_change_pending_since,
        'reassignment_member_id', t.reassignment_member_id,
        'reassignment_proposed_start_at', t.reassignment_proposed_start_at,
        'reassignment_resolved', (select e.reason_code from public.ticket_events e
           where e.ticket_id = t.id and e.type = 'reassignment_resolved'
           order by e.created_at desc, e.id desc limit 1),
        'end_of_day_warned_at', t.end_of_day_warned_at,
        'end_of_day_choice', t.end_of_day_choice,
        'closing_decision', t.closing_decision) order by t.queue_rank)
      from public.tickets t
      where t.salon_id = get_salon_board.salon_id and t.service_date = v_today
        and t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')), '[]'),
    'indicators', (select jsonb_build_object(
        'queue_status', s.queue_status, 'is_full', s.is_full, 'waiting_count', s.waiting_count,
        'current_wait_minutes', s.current_wait_minutes, 'estimate_updated_at', s.estimate_updated_at,
        'queue_version', s.queue_version,
        'last_closing_at', v_closing,
        'end_of_day_warning_minutes', s.end_of_day_warning_minutes,
        'closing_grace_minutes', s.closing_grace_minutes)
      from public.salons s where s.id = get_salon_board.salon_id))
  into v_result;
  return v_result;
end;
$$;
