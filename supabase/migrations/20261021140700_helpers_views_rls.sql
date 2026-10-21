-- DEV-1 step 8a/11: helper functions (§7.1), public views (§6), column grants
-- and RLS policies (§7.2, K32), triggers restrict_member_self_update() and
-- log_settings_update(). Read RPCs (§8.1) come in the next migration.

-- Policies call these helpers as the invoking role, which therefore needs
-- USAGE on private. The tables of private stay closed (no table privilege).
grant usage on schema private to anon, authenticated;

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function private.member_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.salon_members
  where profile_id = auth.uid() and status = 'active'
  limit 1;
$$;

create function private.managed_salon_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select salon_id from public.salon_members
  where profile_id = auth.uid() and status = 'active' and role = 'manager'
  limit 1;
$$;

create function private.staff_salon_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select salon_id from public.salon_members
  where profile_id = auth.uid() and status = 'active'
  limit 1;
$$;

create function private.is_published_salon(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.salons where id = p_salon_id and status = 'published');
$$;

create function private.member_salon_id(p_member_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select salon_id from public.salon_members where id = p_member_id;
$$;

create function private.owns_ticket(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tickets where id = p_ticket_id and client_id = auth.uid());
$$;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated;

-- Public views (§6): owner rights, published salons, listed columns only.
create view public.public_salons with (security_invoker = false) as
select id, slug, name, phone, address_line, postal_code, city, city_code, location,
       queue_status, is_full, welcome_message, photo_paths, waiting_count,
       current_wait_minutes, estimate_updated_at, next_free_slots
from public.salons
where status = 'published';

create view public.public_stylists with (security_invoker = false) as
select m.id, m.salon_id, m.first_name, m.photo_path,
       coalesce((select array_agg(ms.specialty_code order by ms.specialty_code)
                 from public.member_specialties ms where ms.member_id = m.id), '{}') as specialties,
       case p.status
         when 'available' then 'available'
         when 'in_service' then 'busy'
         else 'away'
       end as presence
from public.salon_members m
join public.salons s on s.id = m.salon_id and s.status = 'published'
join public.stylist_presence p
  on p.member_id = m.id
 and p.service_date = (now() at time zone 'Europe/Paris')::date
 and p.status <> 'off_duty'
where m.status = 'active' and m.is_hairdressing;

-- Triggers
create function public.restrict_member_self_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Server (service role, migrations) has no auth.uid(): not restricted.
  if auth.uid() is null or private.managed_salon_id() is not distinct from old.salon_id then
    return new;
  end if;
  if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
    raise exception 'a stylist can only change their own photo' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger salon_members_restrict_self_update
  before update on public.salon_members
  for each row execute function public.restrict_member_self_update();

-- Logs the fact that a setting changed, never its value (K10).
-- TG_ARGV[0], when given, is the comma-separated list of tracked columns.
create function public.log_settings_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_tracked text[] := case when tg_nargs > 0 then string_to_array(tg_argv[0], ',') end;
  v_columns text[];
  v_salon_id uuid;
  v_member uuid := private.member_id();
  v_actor public.actor_type;
begin
  select coalesce(array_agg(k order by k), '{}') into v_columns
  from (select k from jsonb_object_keys(v_row) k
        where k not in ('id', 'created_at', 'updated_at')
          and (v_tracked is null or k = any (v_tracked))
          and (tg_op <> 'UPDATE' or v_old -> k is distinct from v_new -> k)) c;

  -- Cascaded deletes (salon removed) are not settings changes.
  if pg_trigger_depth() > 1 and tg_op = 'DELETE' then
    return null;
  end if;

  if tg_op = 'UPDATE' and cardinality(v_columns) = 0 then
    return null;
  end if;

  v_salon_id := case tg_table_name
    when 'salons' then (v_row ->> 'id')::uuid
    when 'member_specialties' then private.member_salon_id((v_row ->> 'member_id')::uuid)
    else (v_row ->> 'salon_id')::uuid
  end;
  if v_salon_id is null or not exists (select 1 from public.salons where id = v_salon_id) then
    return null; -- salon being deleted: cascade, nothing to log
  end if;

  v_actor := case
    when v_member is null then 'system'
    when private.managed_salon_id() is not null then 'manager'
    else 'stylist'
  end;

  insert into public.salon_events (salon_id, type, actor_type, actor_member_id, actor_profile_id, after)
  values (v_salon_id, 'settings_updated', v_actor, v_member, auth.uid(),
          jsonb_build_object('table', tg_table_name, 'columns', to_jsonb(v_columns)));
  return null;
end;
$$;

revoke execute on function public.restrict_member_self_update() from public, anon, authenticated;
revoke execute on function public.log_settings_update() from public, anon, authenticated;

create trigger salons_log_settings
  after update on public.salons
  for each row execute function public.log_settings_update(
    'name,phone,address_line,postal_code,city,city_code,location,welcome_message,photo_paths');
create trigger salon_members_log_settings
  after insert or update or delete on public.salon_members
  for each row execute function public.log_settings_update('first_name,last_name,photo_path,is_hairdressing');
create trigger member_specialties_log_settings
  after insert or delete on public.member_specialties
  for each row execute function public.log_settings_update();
create trigger opening_hours_log_settings
  after insert or update or delete on public.opening_hours
  for each row execute function public.log_settings_update();
create trigger salon_closures_log_settings
  after insert or update or delete on public.salon_closures
  for each row execute function public.log_settings_update();
create trigger services_log_settings
  after insert or update or delete on public.services
  for each row execute function public.log_settings_update();

-- Column grants (K32): start from nothing, grant what §7.2 allows.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.public_salons, public.public_stylists to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.platform_admins to authenticated;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using ((select private.is_platform_admin()));

grant select on public.salons to authenticated;
grant update (name, phone, address_line, postal_code, city, city_code, location,
              welcome_message, photo_paths) on public.salons to authenticated;
create policy salons_select on public.salons for select to authenticated
  using (id = (select private.staff_salon_id()) or (select private.is_platform_admin()));
create policy salons_update_manager on public.salons for update to authenticated
  using (id = (select private.managed_salon_id()))
  with check (id = (select private.managed_salon_id()));

grant select on public.salon_members to authenticated;
grant update (first_name, last_name, photo_path) on public.salon_members to authenticated;
create policy salon_members_select on public.salon_members for select to authenticated
  using (salon_id = (select private.staff_salon_id()) or (select private.is_platform_admin()));
create policy salon_members_update on public.salon_members for update to authenticated
  using (salon_id = (select private.managed_salon_id()) or id = (select private.member_id()))
  with check (salon_id = (select private.managed_salon_id()) or id = (select private.member_id()));

grant select on public.specialties to anon, authenticated;
grant insert, update, delete on public.specialties to authenticated;
create policy specialties_select on public.specialties for select to anon, authenticated using (true);
create policy specialties_admin_write on public.specialties for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

grant select on public.member_specialties to anon, authenticated;
grant insert, delete on public.member_specialties to authenticated;
create policy member_specialties_select on public.member_specialties for select to anon, authenticated
  using (private.is_published_salon(private.member_salon_id(member_id))
         or private.member_salon_id(member_id) = (select private.staff_salon_id())
         or (select private.is_platform_admin()));
create policy member_specialties_insert on public.member_specialties for insert to authenticated
  with check (private.member_salon_id(member_id) = (select private.managed_salon_id()));
create policy member_specialties_delete on public.member_specialties for delete to authenticated
  using (private.member_salon_id(member_id) = (select private.managed_salon_id()));

do $$
declare t text;
begin
  foreach t in array array['opening_hours', 'salon_closures', 'services'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %1$I_select on public.%1$I for select to anon, authenticated
      using (private.is_published_salon(salon_id) or salon_id = (select private.staff_salon_id())
             or (select private.is_platform_admin()))$p$, t);
    execute format($p$create policy %1$I_insert on public.%1$I for insert to authenticated
      with check (salon_id = (select private.managed_salon_id()))$p$, t);
    execute format($p$create policy %1$I_update on public.%1$I for update to authenticated
      using (salon_id = (select private.managed_salon_id()))
      with check (salon_id = (select private.managed_salon_id()))$p$, t);
    execute format($p$create policy %1$I_delete on public.%1$I for delete to authenticated
      using (salon_id = (select private.managed_salon_id()))$p$, t);
  end loop;
end $$;

grant select on public.stylist_presence to authenticated;
create policy stylist_presence_select on public.stylist_presence for select to authenticated
  using (salon_id = (select private.staff_salon_id()) or (select private.is_platform_admin()));

-- Tickets: no tracking_token / tracking_short_code for any API role. Staff reads
-- the queue through RPC only, so only the client (and the admin) have a policy.
grant select (id, salon_id, service_date, short_code, kind, scheduled_at, appointment_source,
  confirmed_at, client_id, display_name, channel, is_test, service_id, planned_duration_minutes,
  requested_member_id, estimated_member_id, assigned_member_id, status, queue_rank,
  declared_arrival_at, notifications_consent_at, eta_response, declared_delay_minutes, arrived_at,
  estimated_start_at, called_at, started_at, completed_at, cancelled_at, cancel_reason,
  created_at, updated_at)
  on public.tickets to authenticated;
create policy tickets_select on public.tickets for select to authenticated
  using (client_id = (select auth.uid()) or (select private.is_platform_admin()));

-- Event logs: before/after stay behind get_audit_log (RPC).
grant select (id, ticket_id, salon_id, type, actor_type, reason_code, created_at)
  on public.ticket_events to authenticated;
create policy ticket_events_select on public.ticket_events for select to authenticated
  using (
    (select private.is_platform_admin())
    or salon_id = (select private.managed_salon_id())
    or actor_member_id = (select private.member_id())
    or (private.owns_ticket(ticket_id) and type in (
      'created', 'assigned', 'reassigned', 'estimate_changed', 'eta_responded', 'postponed',
      'stylist_change_requested', 'stylist_change_resolved', 'arrival_confirmed', 'called',
      'service_started', 'completed', 'cancelled', 'no_show', 'end_of_day_warned',
      'appointment_checked_in', 'appointment_confirmed', 'appointment_rejected',
      'appointment_delay_warned'))
  );

grant select (id, salon_id, type, actor_type, actor_member_id, subject_member_id, ticket_id,
  reason_code, created_at) on public.salon_events to authenticated;
create policy salon_events_select on public.salon_events for select to authenticated
  using (
    (select private.is_platform_admin())
    or salon_id = (select private.managed_salon_id())
    or actor_member_id = (select private.member_id())
  );

grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using ((select private.is_platform_admin()));

grant select (id, profile_id, ticket_id, member_id, user_agent, created_at, last_success_at, expired_at)
  on public.push_subscriptions to authenticated;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));

grant select (id, salon_id, siret_check_result, checked_at, decision, decision_reason,
  decided_by, decided_at, created_at) on public.salon_verifications to authenticated;
create policy salon_verifications_select on public.salon_verifications for select to authenticated
  using (salon_id = (select private.managed_salon_id()) or (select private.is_platform_admin()));
