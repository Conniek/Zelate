-- Client reads follow the opening hours (F-C1, F-C2, U-01, U-02), and no
-- place outlives its day (PRD §5.2, S-15 scenario 15).
--
-- Until now a salon whose queue the manager left « open » looked open after
-- closing time, with the wait and free slots of the afternoon; and a place
-- that `queue-tick` did not end (job stopped, local dev) stayed active the
-- next days, blocking its client with « déjà une place » while « Ma place »
-- showed nothing.

-- Today's last closing time, Paris time; null on a closed day (no hours or an
-- exceptional closure). The engine refuses a new client from this instant on.
create function private.salon_closes_at(p_salon_id uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select max(((now() at time zone 'Europe/Paris')::date + h.closes_at) at time zone 'Europe/Paris')
  from public.opening_hours h
  where h.salon_id = p_salon_id
    and h.weekday = extract(isodow from (now() at time zone 'Europe/Paris'))::smallint
    and not exists (
      select 1 from public.salon_closures c
      where c.salon_id = p_salon_id
        and (now() at time zone 'Europe/Paris')::date between c.starts_on and c.ends_on);
$$;

-- The next opening after now within a week, closures skipped.
create function private.salon_next_opening(p_salon_id uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select min((d::date + h.opens_at) at time zone 'Europe/Paris')
  from generate_series((now() at time zone 'Europe/Paris')::date,
                       (now() at time zone 'Europe/Paris')::date + 7, interval '1 day') d
  join public.opening_hours h
    on h.salon_id = p_salon_id and h.weekday = extract(isodow from d)::smallint
  where (d::date + h.opens_at) at time zone 'Europe/Paris' > now()
    and not exists (select 1 from public.salon_closures c
                    where c.salon_id = p_salon_id and d::date between c.starts_on and c.ends_on);
$$;

drop function public.search_salons(double precision, double precision, integer, text);

-- `accepting`: the queue takes new clients now (open, today an opening day,
-- before the last closing). Wait, fullness and free slot only mean something
-- then; otherwise the salon shows « Fermé » and its next opening.
create function public.search_salons(
  lat double precision, lng double precision,
  radius_m integer default 5000, query text default null)
returns table (
  id uuid, slug text, name text, address_line text, postal_code text, city text,
  distance_m integer, queue_status public.queue_status, is_full boolean,
  waiting_count integer, current_wait_minutes integer, estimate_updated_at timestamptz,
  next_free_slots jsonb, photo_paths text[],
  latitude double precision, longitude double precision, next_free_slot jsonb,
  next_opening_at timestamptz, accepting boolean, closes_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  ), found as (
    select s.*, round(extensions.st_distance(s.location, o.g))::integer as distance,
           private.salon_closes_at(s.id) as today_closes_at
    from public.salons s, origin o
    where s.status = 'published'
      and extensions.st_dwithin(s.location, o.g, least(greatest(coalesce(radius_m, 5000), 1), 20000))
      and (query is null or s.name ilike '%' || query || '%' or s.city ilike '%' || query || '%')
  ), day as (
    select f.*, (f.today_closes_at is not null and now() < f.today_closes_at) as within_hours
    from found f
  )
  select d.id, d.slug, d.name, d.address_line, d.postal_code, d.city, d.distance,
         d.queue_status, d.is_full, d.waiting_count, d.current_wait_minutes,
         d.estimate_updated_at, d.next_free_slots, d.photo_paths,
         extensions.st_y(d.location::extensions.geometry),
         extensions.st_x(d.location::extensions.geometry),
         case when d.within_hours and d.queue_status = 'open' and not d.is_full then (
           select jsonb_build_object('start_at', slot ->> 'start_at', 'service_name', sv.name)
           from jsonb_array_elements(coalesce(d.next_free_slots, '[]'::jsonb)) slot
           join public.services sv
             on sv.id = (slot ->> 'service_id')::uuid and sv.is_active
           where (slot ->> 'start_at')::timestamptz < d.today_closes_at
           order by (slot ->> 'start_at')::timestamptz
           limit 1) end,
         case when d.queue_status = 'closed' or not d.within_hours
           then private.salon_next_opening(d.id) end,
         d.within_hours and d.queue_status = 'open',
         d.today_closes_at
  from day d
  order by d.distance
  limit 50;
$$;

revoke execute on function public.search_salons(double precision, double precision, integer, text)
  from public, anon, authenticated;
grant execute on function public.search_salons(double precision, double precision, integer, text)
  to anon, authenticated;

-- The salon page says the same: `accepting`, `closes_at`, `next_opening_at`.
create or replace function public.get_salon_public(slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'salon', to_jsonb(v),
    -- E31: "first available" wait and number of clients waiting
    'first_available_wait_minutes', v.current_wait_minutes,
    'waiting_count', v.waiting_count,
    'closes_at', c.at,
    'accepting', v.queue_status = 'open' and c.at is not null and now() < c.at,
    'next_opening_at', case when v.queue_status = 'closed' or c.at is null or now() >= c.at
                         then private.salon_next_opening(v.id) end,
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
  cross join lateral (select private.salon_closes_at(v.id) as at) c
  where v.slug = get_salon_public.slug;
$$;

-- No place outlives its day (S-15 scenario 15). `queue-tick` ends them at
-- closing and at midnight; when it did not run, the next command, tick or
-- nightly maintenance does it here: waiting, called and unconfirmed places
-- are cancelled with the end-of-day reason, a service in progress is
-- completed, their phone copies are closed. Salons whose figures date from
-- an earlier day show no wait until the engine computes today's.
create function private.close_past_days(p_today date default (now() at time zone 'Europe/Paris')::date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  with stale as (
    select t.id, t.salon_id, t.status from public.tickets t
    where t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')
      and not t.is_test and t.service_date < p_today
    for update skip locked
  ), ended as (
    update public.tickets t
    set status = case when s.status = 'in_service' then 'completed'::public.ticket_status
                      else 'cancelled'::public.ticket_status end,
        completed_at = case when s.status = 'in_service'
                            then coalesce(t.started_at, now()) + make_interval(mins => t.planned_duration_minutes)
                            else t.completed_at end,
        cancelled_at = case when s.status = 'in_service' then t.cancelled_at else now() end,
        cancel_reason = case when s.status = 'in_service' then t.cancel_reason
                             else 'end_of_day'::public.cancel_reason end,
        called_at = null, reminder_sent_at = null, release_due_at = null
    from stale s
    where t.id = s.id
    returning t.id, t.salon_id, t.status
  ), contacts as (
    update private.ticket_contacts c
    set is_active = false, is_pending_confirmation = false, closed_at = now()
    from ended e
    where c.ticket_id = e.id and c.is_active
  ), events as (
    insert into public.ticket_events (ticket_id, salon_id, type, actor_type, reason_code)
    select e.id, e.salon_id,
           case when e.status = 'completed' then 'completed'::public.ticket_event_type
                else 'cancelled'::public.ticket_event_type end,
           'system', case when e.status = 'completed' then null else 'end_of_day' end
    from ended e
  )
  select count(*)::integer into n from ended;

  update public.salons s
  set waiting_count = 0, current_wait_minutes = null, is_full = false, next_free_slots = null
  where s.estimate_updated_at < (p_today::timestamp at time zone 'Europe/Paris')
    and (s.waiting_count <> 0 or s.current_wait_minutes is not null or s.is_full
         or s.next_free_slots is not null);
  return n;
end;
$$;

revoke execute on function private.salon_closes_at(uuid) from public, anon, authenticated;
revoke execute on function private.salon_next_opening(uuid) from public, anon, authenticated;
revoke execute on function private.close_past_days(date) from public, anon, authenticated;

-- Hourly as well: a salon with no activity starts the day clean, whatever
-- the time zone offset of the night (cron runs in UTC).
select cron.schedule('close-past-days', '7 * * * *', $$select private.close_past_days()$$);
