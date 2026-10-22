-- U-01, U-16 (F-C1): each salon of the home list and map shows its earliest
-- free slot with the name of its service, only while its queue is open and
-- not full (E22), and a closed salon its next opening (U-01 scenario 9). Same function otherwise; the return type grows by one
-- column, so it is dropped and created again with the same rights.

drop function public.search_salons(double precision, double precision, integer, text);

create function public.search_salons(
  lat double precision, lng double precision,
  radius_m integer default 5000, query text default null)
returns table (
  id uuid, slug text, name text, address_line text, postal_code text, city text,
  distance_m integer, queue_status public.queue_status, is_full boolean,
  waiting_count integer, current_wait_minutes integer, estimate_updated_at timestamptz,
  next_free_slots jsonb, photo_paths text[],
  latitude double precision, longitude double precision, next_free_slot jsonb,
  next_opening_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select s.id, s.slug, s.name, s.address_line, s.postal_code, s.city,
         round(extensions.st_distance(s.location, o.g))::integer,
         s.queue_status, s.is_full, s.waiting_count, s.current_wait_minutes,
         s.estimate_updated_at, s.next_free_slots, s.photo_paths,
         extensions.st_y(s.location::extensions.geometry),
         extensions.st_x(s.location::extensions.geometry),
         case when s.queue_status = 'open' and not s.is_full then (
           select jsonb_build_object('start_at', slot ->> 'start_at', 'service_name', sv.name)
           from jsonb_array_elements(coalesce(s.next_free_slots, '[]'::jsonb)) slot
           join public.services sv
             on sv.id = (slot ->> 'service_id')::uuid and sv.is_active
           order by (slot ->> 'start_at')::timestamptz
           limit 1) end,
         -- The next opening within a week, Paris time, closures skipped.
         case when s.queue_status = 'closed' then (
           select min((d::date + h.opens_at) at time zone 'Europe/Paris')
           from generate_series((now() at time zone 'Europe/Paris')::date,
                                (now() at time zone 'Europe/Paris')::date + 7, interval '1 day') d
           join public.opening_hours h
             on h.salon_id = s.id and h.weekday = extract(isodow from d)::smallint
           where (d::date + h.opens_at) at time zone 'Europe/Paris' > now()
             and not exists (select 1 from public.salon_closures c
                             where c.salon_id = s.id and d::date between c.starts_on and c.ends_on)) end
  from public.salons s, origin o
  where s.status = 'published'
    and extensions.st_dwithin(s.location, o.g, least(greatest(coalesce(radius_m, 5000), 1), 20000))
    and (query is null or s.name ilike '%' || query || '%' or s.city ilike '%' || query || '%')
  order by extensions.st_distance(s.location, o.g)
  limit 50;
$$;

revoke execute on function public.search_salons(double precision, double precision, integer, text)
  from public, anon, authenticated;
grant execute on function public.search_salons(double precision, double precision, integer, text)
  to anon, authenticated;
