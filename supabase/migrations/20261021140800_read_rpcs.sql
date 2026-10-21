-- DEV-1 step 8b/11: read RPCs (BACKEND_SCHEMA §8.1).
-- preview_presence_change is not here: it needs the queue engine (TypeScript)
-- and is served by an Edge Function.

create function public.search_salons(
  lat double precision, lng double precision,
  radius_m integer default 5000, query text default null)
returns table (
  id uuid, slug text, name text, address_line text, postal_code text, city text,
  distance_m integer, queue_status public.queue_status, is_full boolean,
  waiting_count integer, current_wait_minutes integer, estimate_updated_at timestamptz,
  next_free_slots jsonb, photo_paths text[])
language sql stable security definer set search_path = '' as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select s.id, s.slug, s.name, s.address_line, s.postal_code, s.city,
         round(extensions.st_distance(s.location, o.g))::integer,
         s.queue_status, s.is_full, s.waiting_count, s.current_wait_minutes,
         s.estimate_updated_at, s.next_free_slots, s.photo_paths
  from public.salons s, origin o
  where s.status = 'published'
    and extensions.st_dwithin(s.location, o.g, least(greatest(coalesce(radius_m, 5000), 1), 20000))
    and (query is null or s.name ilike '%' || query || '%' or s.city ilike '%' || query || '%')
  order by extensions.st_distance(s.location, o.g)
  limit 50;
$$;

create function public.get_salon_public(slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'salon', to_jsonb(v),
    -- E31: "first available" wait and number of clients waiting
    'first_available_wait_minutes', v.current_wait_minutes,
    'waiting_count', v.waiting_count,
    'services', coalesce((select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'duration_minutes', sv.duration_minutes,
        'price_cents', sv.price_cents, 'required_specialty_code', sv.required_specialty_code)
        order by sv.sort_order, sv.name)
      from public.services sv where sv.salon_id = v.id and sv.is_active), '[]'),
    'opening_hours', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
        order by h.weekday, h.opens_at)
      from public.opening_hours h where h.salon_id = v.id), '[]'),
    'stylists', coalesce((select jsonb_agg(to_jsonb(st) - 'salon_id' order by st.first_name)
      from public.public_stylists st where st.salon_id = v.id), '[]')
  )
  from public.public_salons v
  where v.slug = get_salon_public.slug;
$$;

create function public.resolve_qr_token(qr_token text)
returns text language sql stable security definer set search_path = '' as $$
  select s.slug from public.salons s
  where s.qr_token = resolve_qr_token.qr_token and s.status = 'published';
$$;

-- Invoker: the client's own RLS applies. Salon and stylist come from the
-- public views, tickets from the granted columns (no tracking token).
create function public.my_active_ticket()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'salon_id', t.salon_id, 'service_date', t.service_date, 'short_code', t.short_code,
      'kind', t.kind, 'scheduled_at', t.scheduled_at, 'display_name', t.display_name,
      'status', t.status, 'queue_rank', t.queue_rank, 'planned_duration_minutes', t.planned_duration_minutes,
      'estimated_start_at', t.estimated_start_at, 'eta_response', t.eta_response,
      'declared_delay_minutes', t.declared_delay_minutes, 'arrived_at', t.arrived_at,
      'called_at', t.called_at, 'started_at', t.started_at),
    'salon', to_jsonb(sv),
    'assigned_stylist_first_name', st.first_name)
  from public.tickets t
  join public.public_salons sv on sv.id = t.salon_id
  left join public.public_stylists st on st.id = t.assigned_member_id
  where t.client_id = (select auth.uid())
    and t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')
    and not t.is_test
  limit 1;
$$;

create function public.get_stylist_queue()
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
        and (j.estimated_member_id = v_member or j.requested_member_id = v_member)), '[]'),
    'appointments', coalesce((select jsonb_agg(to_jsonb(j) order by j.scheduled_at) from j
      where j.kind = 'appointment' and j.assigned_member_id = v_member
        and j.status in ('waiting', 'called', 'in_service')), '[]'))
  into v_result;
  return v_result;
end;
$$;

create function public.get_salon_board(salon_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_result jsonb;
begin
  if salon_id is distinct from private.managed_salon_id() then
    raise exception 'not the manager of this salon' using errcode = '42501';
  end if;

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
        'reassignment_resolved', (select e.after from public.ticket_events e
           where e.ticket_id = t.id and e.type = 'reassignment_resolved'
           order by e.created_at desc, e.id desc limit 1)) order by t.queue_rank)
      from public.tickets t
      where t.salon_id = get_salon_board.salon_id and t.service_date = v_today
        and t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')), '[]'),
    'indicators', (select jsonb_build_object(
        'queue_status', s.queue_status, 'is_full', s.is_full, 'waiting_count', s.waiting_count,
        'current_wait_minutes', s.current_wait_minutes, 'estimate_updated_at', s.estimate_updated_at,
        'queue_version', s.queue_version)
      from public.salons s where s.id = get_salon_board.salon_id))
  into v_result;
  return v_result;
end;
$$;

create function public.get_audit_log(
  salon_id uuid default null,
  "from" timestamptz default now() - interval '7 days',
  "to" timestamptz default now(),
  type text default null,
  member_id uuid default null,
  cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_salon uuid := coalesce(get_audit_log.salon_id, private.managed_salon_id());
  v_result jsonb;
begin
  if v_salon is null
     or not (v_salon = private.managed_salon_id() or private.is_platform_admin()) then
    raise exception 'not allowed to read this audit log' using errcode = '42501';
  end if;

  with log as (
    select 'salon'::text as source, e.id, e.created_at, e.type::text as type, e.actor_type::text as actor_type,
           e.actor_member_id, e.subject_member_id, e.ticket_id, e.reason_code, e.before, e.after
    from public.salon_events e where e.salon_id = v_salon
    union all
    select 'ticket', e.id, e.created_at, e.type::text, e.actor_type::text,
           e.actor_member_id, null, e.ticket_id, e.reason_code, e.before, e.after
    from public.ticket_events e where e.salon_id = v_salon
  ), page as (
    select l.*, m.first_name as actor_first_name, t.short_code as ticket_code
    from log l
    left join public.salon_members m on m.id = l.actor_member_id
    left join public.tickets t on t.id = l.ticket_id
    where l.created_at >= "from" and l.created_at <= "to"
      and (get_audit_log.type is null or l.type = get_audit_log.type)
      and (get_audit_log.member_id is null
           or l.actor_member_id = get_audit_log.member_id or l.subject_member_id = get_audit_log.member_id)
      and (cursor is null or (l.created_at, l.source, l.id) <
           ((cursor ->> 'created_at')::timestamptz, cursor ->> 'source', (cursor ->> 'id')::bigint))
    order by l.created_at desc, l.source desc, l.id desc
    limit 51
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'source', p.source, 'id', p.id, 'created_at', p.created_at, 'type', p.type,
        'actor_type', p.actor_type, 'actor_member_id', p.actor_member_id,
        'actor_first_name', p.actor_first_name, 'ticket_id', p.ticket_id, 'ticket_code', p.ticket_code,
        'reason_code', p.reason_code, 'before', p.before, 'after', p.after)
        order by p.created_at desc, p.source desc, p.id desc)
      from (select * from page order by created_at desc, source desc, id desc limit 50) p), '[]'),
    'next_cursor', (select jsonb_build_object('created_at', p.created_at, 'source', p.source, 'id', p.id)
      from (select * from page order by created_at desc, source desc, id desc limit 1 offset 49) p
      where (select count(*) from page) > 50))
  into v_result;
  return v_result;
end;
$$;

create function public.get_day_summary(salon_id uuid, service_date date, member_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.member_id();
  v_manager uuid := private.managed_salon_id();
  v_member uuid := get_day_summary.member_id;
  v_result jsonb;
begin
  if salon_id is distinct from v_manager then
    -- A stylist only reads their own figures.
    if v_me is null or salon_id is distinct from private.staff_salon_id()
       or (v_member is not null and v_member <> v_me) then
      raise exception 'not allowed to read this summary' using errcode = '42501';
    end if;
    v_member := v_me;
  end if;

  select jsonb_build_object(
    'served_count', count(*) filter (where t.status = 'completed'),
    'announced_wait_minutes', round(avg(extract(epoch from t.initial_estimated_start_at - t.created_at) / 60)
      filter (where t.status = 'completed' and t.initial_estimated_start_at is not null)),
    'actual_wait_minutes', round(avg(extract(epoch from t.started_at - t.created_at) / 60)
      filter (where t.status = 'completed' and t.started_at is not null)),
    'no_show_count', count(*) filter (where t.status = 'no_show'),
    'cancelled_count', count(*) filter (where t.status = 'cancelled'))
  into v_result
  from public.tickets t
  where t.salon_id = get_day_summary.salon_id and t.service_date = get_day_summary.service_date
    and not t.is_test
    and (v_member is null or t.assigned_member_id = v_member);
  return v_result;
end;
$$;

-- Explicit execute rights: nothing by default, then what §8.1 allows.
do $$
declare f text;
begin
  foreach f in array array[
    'public.search_salons(double precision, double precision, integer, text)',
    'public.get_salon_public(text)', 'public.resolve_qr_token(text)',
    'public.my_active_ticket()', 'public.get_stylist_queue()', 'public.get_salon_board(uuid)',
    'public.get_audit_log(uuid, timestamptz, timestamptz, text, uuid, jsonb)',
    'public.get_day_summary(uuid, date, uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.search_salons(double precision, double precision, integer, text),
  public.get_salon_public(text), public.resolve_qr_token(text) to anon, authenticated;
grant execute on function public.my_active_ticket(), public.get_stylist_queue(),
  public.get_salon_board(uuid), public.get_day_summary(uuid, date, uuid),
  public.get_audit_log(uuid, timestamptz, timestamptz, text, uuid, jsonb) to authenticated;
