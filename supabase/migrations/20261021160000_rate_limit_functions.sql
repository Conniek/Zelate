-- DEV-3 step 1: atomic rate-limit helpers over private.rate_limits
-- (BACKEND_SCHEMA §5, PRD §5.3 P-03). Fixed windows; the key is hashed so the
-- table never holds a phone number or an IP address. Called by Edge Functions
-- with the service role only.

create function public.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_bucket is null or p_key is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- The WHERE clause makes a refused call leave the counter untouched.
  insert into private.rate_limits as r (bucket, key_hash, window_start, count)
  values (p_bucket, extensions.digest(p_key, 'sha256'), v_window, 1)
  on conflict (bucket, key_hash, window_start)
  do update set count = r.count + 1 where r.count < p_limit
  returning r.count into v_count;

  return v_count is not null;
end $$;

create function public.is_rate_limited(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.count >= p_limit
    from private.rate_limits r
    where r.bucket = p_bucket
      and r.key_hash = extensions.digest(p_key, 'sha256')
      and r.window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
  ), false)
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.is_rate_limited(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.is_rate_limited(text, text, integer, integer) to service_role;
