-- Stylist invitations (S-04, C-01). Called by the invite-member and
-- activate-invitation Edge Functions with the service role only; the functions hold
-- the token, the database only ever sees its SHA-256 hash.
-- Error codes travel as the exception message (same convention as the admin RPCs).

create function public.invite_member(
  p_manager uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_specialties text[],
  p_token_hash bytea,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager_member uuid;
  v_salon uuid;
  v_salon_name text;
  v_member uuid;
  v_email extensions.citext := lower(btrim(p_email));
begin
  select m.id, m.salon_id into v_manager_member, v_salon
  from public.salon_members m
  where m.profile_id = p_manager and m.role = 'manager' and m.status = 'active';
  if v_salon is null then
    raise exception 'queue.forbidden' using errcode = 'ZA403';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or char_length(btrim(p_first_name)) > 30
     or btrim(coalesce(p_last_name, '')) = '' or char_length(btrim(p_last_name)) > 50
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email::text) > 254 then
    raise exception 'queue.invalid_payload' using errcode = 'ZA400';
  end if;
  if coalesce(cardinality(p_specialties), 0) = 0 then
    raise exception 'team.specialty_required' using errcode = 'ZA400';
  end if;

  -- Serializes concurrent invitations of one salon (limit and double click).
  perform 1 from public.salons where id = v_salon for update;

  -- Same message whether the address is in this salon or in another one (isolation).
  if exists (
    select 1 from public.salon_members m
    where m.email = v_email
      and (m.salon_id = v_salon or (m.role = 'stylist' and m.status <> 'deactivated'))
  ) then
    raise exception 'team.email_already_used' using errcode = 'ZA409';
  end if;

  if (select count(*) from public.salon_members
      where salon_id = v_salon and role = 'stylist' and status <> 'deactivated') >= 20 then
    raise exception 'team.limit_reached' using errcode = 'ZA409';
  end if;

  insert into public.salon_members (salon_id, role, status, first_name, last_name, email)
  values (v_salon, 'stylist', 'invited', btrim(p_first_name), btrim(p_last_name), v_email)
  returning id into v_member;

  insert into public.member_specialties (member_id, specialty_code)
  select v_member, code from unnest(p_specialties) as code
  on conflict do nothing;

  insert into private.member_invitations (member_id, token_hash, expires_at)
  values (v_member, p_token_hash, p_expires_at);

  insert into public.salon_events (salon_id, type, actor_type, actor_member_id, actor_profile_id, subject_member_id)
  values (v_salon, 'member_invited', 'manager', v_manager_member, p_manager, v_member);

  select name into v_salon_name from public.salons where id = v_salon;
  return jsonb_build_object('member_id', v_member, 'salon_name', v_salon_name);
exception
  when foreign_key_violation then
    raise exception 'queue.invalid_payload' using errcode = 'ZA400';
  when unique_violation then
    raise exception 'team.email_already_used' using errcode = 'ZA409';
end $$;

-- What the invitation page needs; one error for unknown, used and expired links.
create function public.peek_invitation(p_token_hash bytea) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object('member_id', m.id, 'email', m.email, 'first_name', m.first_name,
                            'salon_name', s.name)
  into v_result
  from private.member_invitations i
  join public.salon_members m on m.id = i.member_id
  join public.salons s on s.id = m.salon_id
  where i.token_hash = p_token_hash and i.used_at is null and i.expires_at > now()
    and m.status = 'invited';
  if v_result is null then
    raise exception 'invite.link_invalid' using errcode = 'ZA410';
  end if;
  return v_result;
end $$;

create function public.find_auth_user_id(p_email text) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

create function public.activate_invitation(p_token_hash bytea, p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.salon_members;
  v_invitation private.member_invitations;
begin
  select * into v_invitation from private.member_invitations
  where token_hash = p_token_hash for update;
  if v_invitation.member_id is null or v_invitation.used_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'invite.link_invalid' using errcode = 'ZA410';
  end if;

  select * into v_member from public.salon_members
  where id = v_invitation.member_id for update;
  if v_member.status <> 'invited' then
    raise exception 'invite.link_invalid' using errcode = 'ZA410';
  end if;

  -- An existing account (client or other) is reused, never duplicated.
  insert into public.profiles (id, first_name, last_name, email, is_guest)
  values (p_user_id, v_member.first_name, v_member.last_name, v_member.email, false)
  on conflict (id) do update set is_guest = false;

  update public.salon_members set profile_id = p_user_id, status = 'active'
  where id = v_member.id;
  update private.member_invitations set used_at = now() where member_id = v_member.id;

  insert into public.salon_events (salon_id, type, actor_type, actor_member_id, actor_profile_id, subject_member_id)
  values (v_member.salon_id, 'member_activated', 'stylist', v_member.id, p_user_id, v_member.id);

  return jsonb_build_object('email', v_member.email);
end $$;

revoke all on function public.invite_member(uuid, text, text, text, text[], bytea, timestamptz) from public, anon, authenticated;
revoke all on function public.peek_invitation(bytea) from public, anon, authenticated;
revoke all on function public.find_auth_user_id(text) from public, anon, authenticated;
revoke all on function public.activate_invitation(bytea, uuid) from public, anon, authenticated;
grant execute on function public.invite_member(uuid, text, text, text, text[], bytea, timestamptz) to service_role;
grant execute on function public.peek_invitation(bytea) to service_role;
grant execute on function public.find_auth_user_id(text) to service_role;
grant execute on function public.activate_invitation(bytea, uuid) to service_role;
