-- DEV-6: stylist space (C-01 to C-11, S-16).

-- ADR-019, K4: a revoked session loses staff access at once, not when its
-- 15-min access token expires. Real tokens always carry `session_id`; tests
-- that only set `sub` keep working.
create function private.session_alive()
returns boolean language sql stable security definer set search_path = '' as $$
  select (auth.jwt() ->> 'session_id') is null
    or exists (select 1 from auth.sessions s
               where s.id = (auth.jwt() ->> 'session_id')::uuid);
$$;
revoke execute on function private.session_alive() from public, anon, authenticated;

create or replace function private.member_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.salon_members
  where profile_id = auth.uid() and status = 'active' and private.session_alive()
  order by created_at, id
  limit 1;
$$;

create or replace function private.managed_salon_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select salon_id from public.salon_members
  where profile_id = auth.uid() and status = 'active' and role = 'manager'
    and private.session_alive()
  order by created_at, id
  limit 1;
$$;

create or replace function private.staff_salon_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select salon_id from public.salon_members
  where profile_id = auth.uid() and status = 'active' and private.session_alive()
  order by created_at, id
  limit 1;
$$;

-- Who the signed-in person is in the stylist space (F-S2): `active`,
-- `deactivated` (« Votre accès a été retiré ») or `none`. Only ever about the caller.
create function public.stylist_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
       'access', 'active', 'member_id', m.id, 'salon_id', m.salon_id, 'role', m.role,
       'first_name', m.first_name, 'is_hairdressing', m.is_hairdressing,
       'salon_name', s.name, 'queue_status', s.queue_status,
       'service_date', (now() at time zone 'Europe/Paris')::date,
       'presence', (select jsonb_build_object('status', p.status, 'break_type', p.break_type,
                      'expected_back_at', p.expected_back_at, 'shift_end_at', p.shift_end_at)
                    from public.stylist_presence p
                    where p.member_id = m.id
                      and p.service_date = (now() at time zone 'Europe/Paris')::date))
     from public.salon_members m join public.salons s on s.id = m.salon_id
     where m.id = private.member_id()),
    (select jsonb_build_object('access', 'deactivated') from public.salon_members m
     where m.profile_id = auth.uid() and m.status = 'deactivated' limit 1),
    jsonb_build_object('access', 'none'));
$$;
revoke all on function public.stylist_context() from public, anon;
grant execute on function public.stylist_context() to authenticated;

-- Call card (F-S5, F-S8): release time, reminder, postponements; `is_test`
-- so that the test client is shown as such (K24).
create or replace function public.get_stylist_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_member uuid := private.member_id();
  v_salon uuid := private.staff_salon_id();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_result jsonb;
begin
  if v_member is null then
    raise exception 'not an active member' using errcode = '42501';
  end if;

  with j as (
    select t.id, t.short_code, t.display_name, t.status, t.kind, t.queue_rank, t.scheduled_at,
           t.planned_duration_minutes, t.estimated_start_at, t.eta_response,
           t.declared_delay_minutes, t.arrived_at, t.called_at, t.started_at,
           t.assigned_member_id, t.estimated_member_id, t.requested_member_id,
           t.service_id, t.release_due_at, t.reminder_sent_at, t.call_count,
           t.postpone_count, t.declared_arrival_at, t.is_test,
           sv.name as service_name
    from public.tickets t
    left join public.services sv on sv.id = t.service_id
    where t.salon_id = v_salon and t.service_date = v_today
  )
  select jsonb_build_object(
    'current', (select to_jsonb(j) from j where j.status = 'in_service' and j.assigned_member_id = v_member limit 1),
    'called', (select to_jsonb(j) from j where j.status = 'called' and j.assigned_member_id = v_member limit 1),
    'pending_appointments', coalesce((select jsonb_agg(to_jsonb(j) order by j.scheduled_at) from j
      where j.status = 'pending_confirmation' and j.requested_member_id = v_member), '[]'),
    'next', coalesce((select jsonb_agg(to_jsonb(j) order by j.queue_rank) from j
      where j.status = 'waiting'
        and (j.estimated_member_id = v_member or j.requested_member_id = v_member
             or (j.kind = 'appointment' and j.assigned_member_id = v_member))), '[]'),
    'appointments', coalesce((select jsonb_agg(to_jsonb(j) order by j.scheduled_at) from j
      where j.kind = 'appointment' and j.assigned_member_id = v_member
        and j.status in ('waiting', 'called', 'in_service')), '[]'))
  into v_result;
  return v_result;
end;
$$;
