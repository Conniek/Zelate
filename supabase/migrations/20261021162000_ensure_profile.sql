-- DEV-3 step 5: first sign-in creates the profile (K30). No Auth trigger,
-- and clients have no INSERT grant on profiles, so a SECURITY DEFINER RPC does it.

create or replace function public.ensure_profile(p_first_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_first_name, ''));
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  if char_length(v_name) not between 1 and 30 then
    raise exception 'invalid first name' using errcode = '22023';
  end if;

  insert into public.profiles (id, first_name)
  values (auth.uid(), v_name)
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke all on function public.ensure_profile(text) from public, anon;
grant execute on function public.ensure_profile(text) to authenticated;
