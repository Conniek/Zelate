-- DEV-4 step 1a: salon sign-up drafts (S-01 scenarios 7-9) and the final submit.
-- salons has NOT NULL address and SIRET columns, so a partial draft cannot live
-- there: it is kept in a private table and the salon is created at submit.

create table private.signup_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  step smallint not null default 1 check (step between 1 and 4),
  data jsonb not null default '{}',
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint signup_drafts_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint signup_drafts_no_password check (not (data ? 'password')),
  constraint signup_drafts_small check (pg_column_size(data) <= 8192)
);

create index signup_drafts_expires_at_idx on private.signup_drafts (expires_at);
alter table private.signup_drafts enable row level security;

-- The expiry counts from the last save (open question of S-01, flagged for review).
create function public.save_signup_draft(p_step smallint, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_step not between 1 and 4 or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid draft' using errcode = '22023';
  end if;

  insert into private.signup_drafts as d (user_id, step, data, expires_at)
  values (auth.uid(), p_step, p_data, now() + interval '7 days')
  on conflict (user_id) do update
    set step = excluded.step,
        data = d.data || excluded.data,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

create function public.get_signup_draft()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('step', d.step, 'data', d.data)
  from private.signup_drafts d
  where d.user_id = auth.uid() and d.expires_at > now();
$$;

revoke all on function public.save_signup_draft(smallint, jsonb) from public, anon;
revoke all on function public.get_signup_draft() from public, anon;
grant execute on function public.save_signup_draft(smallint, jsonb) to authenticated;
grant execute on function public.get_signup_draft() to authenticated;

-- Called by the salon-signup Edge Function (service role) after it checked the
-- SIRET. One transaction: profile, salon, manager member, verification, event.
-- Idempotent: a manager who already has a salon gets it back (double click, S-01 scenario 12).
create function private.slugify(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(p_name),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ',
      'aaaaaaceeeeiiiinooooouuuuyyoa'),
    '[^a-z0-9]+', '-', 'g'));
$$;

create function public.submit_salon_signup(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_salon_name text,
  p_phone text,
  p_address_line text,
  p_postal_code text,
  p_city text,
  p_city_code text,
  p_longitude double precision,
  p_latitude double precision,
  p_siret text,
  p_naf_code text,
  p_siret_check_result public.siret_check_result,
  p_siret_check_payload jsonb,
  p_is_hairdressing boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext;
  v_salon_id uuid;
  v_slug text;
  v_member_id uuid;
begin
  select m.salon_id into v_salon_id
  from public.salon_members m
  where m.profile_id = p_user_id and m.role = 'manager';
  if found then
    return v_salon_id;
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'unknown user' using errcode = '28000';
  end if;

  insert into public.profiles (id, first_name, last_name, email, is_guest)
  values (p_user_id, btrim(p_first_name), nullif(btrim(p_last_name), ''), v_email, false)
  on conflict (id) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        email = excluded.email,
        is_guest = false;

  v_slug := left(private.slugify(p_salon_name), 50);
  if char_length(v_slug) < 3 then v_slug := 'salon'; end if;
  v_slug := v_slug || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 5);

  insert into public.salons (
    slug, name, phone, address_line, postal_code, city, city_code, location,
    siret, naf_code, status, created_by)
  values (
    v_slug, btrim(p_salon_name), p_phone, p_address_line, p_postal_code, p_city, p_city_code,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_siret, p_naf_code, 'pending_review', p_user_id)
  returning id into v_salon_id;

  insert into public.salon_members (
    salon_id, profile_id, role, status, first_name, last_name, email, is_hairdressing)
  values (
    v_salon_id, p_user_id, 'manager', 'active', btrim(p_first_name),
    coalesce(nullif(btrim(p_last_name), ''), ''), v_email, p_is_hairdressing)
  returning id into v_member_id;

  insert into public.salon_verifications (salon_id, siret_check_result, siret_check_payload, checked_at)
  values (v_salon_id, p_siret_check_result, p_siret_check_payload, now());

  insert into public.salon_events (salon_id, type, actor_type, actor_member_id, actor_profile_id)
  values (v_salon_id, 'submitted', 'manager', v_member_id, p_user_id);

  delete from private.signup_drafts where user_id = p_user_id;
  return v_salon_id;
end;
$$;

revoke all on function public.submit_salon_signup(uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, public.siret_check_result, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_salon_signup(uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, public.siret_check_result, jsonb, boolean)
  to service_role;
