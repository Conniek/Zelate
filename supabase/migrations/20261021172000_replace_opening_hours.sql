-- Atomic replacement of a salon's weekly hours (S-03). Runs as the caller, so the
-- RLS policies of opening_hours (manager of the salon only) still apply.
create or replace function public.replace_opening_hours(p_hours jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_salon uuid := private.managed_salon_id();
begin
  if v_salon is null then
    raise exception 'auth.forbidden' using errcode = 'ZA403';
  end if;
  if jsonb_typeof(p_hours) is distinct from 'array' then
    raise exception 'validation.hours_order' using errcode = 'ZA400';
  end if;

  delete from public.opening_hours where salon_id = v_salon;
  insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
  select v_salon, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) as h;
exception
  when check_violation then
    raise exception 'validation.hours_order' using errcode = 'ZA400';
  when exclusion_violation then
    raise exception 'validation.hours_overlap' using errcode = 'ZA400';
end $$;

revoke all on function public.replace_opening_hours(jsonb) from public, anon;
grant execute on function public.replace_opening_hours(jsonb) to authenticated;
