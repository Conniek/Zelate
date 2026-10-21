-- QR poster (S-06). Called by the regenerate-qr Edge Function with the service role.
-- p_rotate = false only reads the current token (first poster generation).
create function public.rotate_qr_token(p_manager uuid, p_rotate boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_salon public.salons;
begin
  select m.id, m.salon_id into v_member, v_salon.id
  from public.salon_members m
  where m.profile_id = p_manager and m.role = 'manager' and m.status = 'active';
  if v_salon.id is null then
    raise exception 'queue.forbidden' using errcode = 'ZA403';
  end if;

  if p_rotate then
    update public.salons
    set qr_token = encode(extensions.gen_random_bytes(16), 'hex')
    where id = v_salon.id;
    insert into public.salon_events (salon_id, type, actor_type, actor_member_id, actor_profile_id)
    values (v_salon.id, 'qr_regenerated', 'manager', v_member, p_manager);
  end if;

  select * into v_salon from public.salons where id = v_salon.id;
  return jsonb_build_object('salon_id', v_salon.id, 'salon_name', v_salon.name,
                            'qr_token', v_salon.qr_token);
end $$;

revoke all on function public.rotate_qr_token(uuid, boolean) from public, anon, authenticated;
grant execute on function public.rotate_qr_token(uuid, boolean) to service_role;
