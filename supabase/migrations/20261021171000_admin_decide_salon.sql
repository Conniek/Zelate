-- DEV-4 step 2 (P-01): the platform admin lists, reads and decides salon files.
-- Application errors carry their code as the message (TRD §6.1 error codes).
-- E-mails to the manager (scenarios 3 and 6) wait for the e-mail port.

create function public.admin_list_salons(p_filter text default 'to_review')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_filter not in ('to_review', 'all') then
    raise exception 'invalid filter' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'salon_id', s.id,
      'name', s.name,
      'city', s.city,
      'status', s.status,
      'submitted_at', v.created_at,
      'siret_check_result', v.siret_check_result,
      'decision', v.decision
    ) order by v.created_at)
    from public.salon_verifications v
    join public.salons s on s.id = v.salon_id
    where p_filter = 'all' or (v.decision = 'pending' and s.status = 'pending_review')
  ), '[]'::jsonb);
end;
$$;

create function public.admin_get_salon(p_salon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
      'salon_id', s.id,
      'name', s.name,
      'phone', s.phone,
      'address_line', s.address_line,
      'postal_code', s.postal_code,
      'city', s.city,
      'siret', s.siret,
      'naf_code', s.naf_code,
      'status', s.status,
      'longitude', extensions.st_x(s.location::extensions.geometry),
      'latitude', extensions.st_y(s.location::extensions.geometry),
      'manager', (
        select jsonb_build_object('first_name', m.first_name, 'last_name', m.last_name, 'email', m.email)
        from public.salon_members m where m.salon_id = s.id and m.role = 'manager'),
      'siret_check_result', v.siret_check_result,
      'checked_at', v.checked_at,
      'decision', v.decision,
      'decision_reason', v.decision_reason,
      'decided_at', v.decided_at,
      'submitted_at', v.created_at)
  into v_result
  from public.salons s
  join public.salon_verifications v on v.salon_id = s.id
  where s.id = p_salon_id;

  return v_result;
end;
$$;

create function public.admin_decide_salon(
  p_salon_id uuid,
  p_decision public.verification_decision,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_verification public.salon_verifications%rowtype;
  v_status public.salon_status;
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision = 'pending' then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception 'validation.reject_reason_required' using errcode = 'ZA400';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  -- The row lock serialises two admins deciding at the same time.
  select * into v_verification
  from public.salon_verifications where salon_id = p_salon_id for update;
  if not found then
    raise exception 'admin.salon_not_found' using errcode = 'ZA404';
  end if;
  select status into v_status from public.salons where id = p_salon_id;
  if v_verification.decision <> 'pending' or v_status <> 'pending_review' then
    raise exception 'admin.salon_already_decided' using errcode = 'ZA409';
  end if;

  update public.salon_verifications
  set decision = p_decision,
      decision_reason = case when p_decision = 'rejected' then v_reason else null end,
      decided_by = auth.uid(),
      decided_at = now()
  where id = v_verification.id;

  update public.salons
  set status = case when p_decision = 'approved' then 'approved'::public.salon_status
                    else 'rejected'::public.salon_status end
  where id = p_salon_id;

  insert into public.salon_events (salon_id, type, actor_type, actor_profile_id, before, after)
  values (p_salon_id,
          case when p_decision = 'approved' then 'approved'::public.salon_event_type
               else 'rejected'::public.salon_event_type end,
          'admin', auth.uid(),
          jsonb_build_object('status', 'pending_review'),
          jsonb_build_object('status', p_decision));
end;
$$;

revoke all on function public.admin_list_salons(text) from public, anon;
revoke all on function public.admin_get_salon(uuid) from public, anon;
revoke all on function public.admin_decide_salon(uuid, public.verification_decision, text) from public, anon;
grant execute on function public.admin_list_salons(text) to authenticated;
grant execute on function public.admin_get_salon(uuid) to authenticated;
grant execute on function public.admin_decide_salon(uuid, public.verification_decision, text) to authenticated;
