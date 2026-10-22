-- DEV-8 part 4 (U-13, K17, K29): the client's data export and account deletion.
-- Called only by the Edge Functions `account-export` and `account-delete`
-- (service role), for the caller they authenticated.

-- The client's own data (RGPD right of access): profile with his phone
-- number, consents, every ticket and its events visible to him (BACKEND_SCHEMA
-- §7.3 rule 3). Never a tracking token, a staff note or another person's data.
create function public.account_export(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select jsonb_build_object(
        'first_name', p.first_name, 'last_name', p.last_name,
        'phone', case when u.phone is null or u.phone = '' then null else '+' || ltrim(u.phone, '+') end,
        'created_at', p.created_at,
        'tracking_consent_at', p.tracking_consent_at,
        'marketing_consent_at', p.marketing_consent_at)
      from public.profiles p
      left join auth.users u on u.id = p.id
      where p.id = p_profile_id),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
          'salon', s.name, 'service_date', t.service_date, 'kind', t.kind,
          'scheduled_at', t.scheduled_at, 'display_name', t.display_name,
          'status', t.status, 'channel', t.channel, 'service', sv.name,
          'created_at', t.created_at, 'arrived_at', t.arrived_at,
          'called_at', t.called_at, 'started_at', t.started_at,
          'completed_at', t.completed_at, 'cancelled_at', t.cancelled_at,
          'cancel_reason', t.cancel_reason, 'no_show_at', t.no_show_at,
          'notifications_consent_at', t.notifications_consent_at,
          'events', coalesce((
            select jsonb_agg(jsonb_build_object('type', e.type, 'reason', e.reason_code, 'at', e.created_at)
                             order by e.created_at, e.id)
            from public.ticket_events e
            where e.ticket_id = t.id
              and e.type::text not in ('duration_adjusted', 'appointment_merged', 'appointment_updated',
                                       'end_of_day_responded')
              and e.type::text not like 'reassignment\_%'), '[]'::jsonb))
        order by t.created_at)
      from public.tickets t
      join public.salons s on s.id = t.salon_id
      left join public.services sv on sv.id = t.service_id
      where t.client_id = p_profile_id and not t.is_test), '[]'::jsonb));
$$;

-- Deletes the account once its active place is cancelled (by `queue-command`,
-- K38): past tickets keep their times for the statistics but name nobody
-- (K29), their phone copies go, and the Auth account with its sessions, the
-- profile and its push subscriptions are removed. The audit log stays as it
-- is: it holds no first name nor free text (K10). `no_show_records` keep
-- their 30 days: deleting an account does not reset the abuse limits (P-03).
-- Returns `deleted`, `active_ticket` (cancel it first) or `staff` (an
-- account of Zelaté Pro is not deleted from the client app).
create function public.account_delete(p_profile_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.salon_members m where m.profile_id = p_profile_id)
     or exists (select 1 from public.salons s where s.created_by = p_profile_id)
     or exists (select 1 from public.platform_admins a where a.user_id = p_profile_id) then
    return 'staff';
  end if;
  if exists (
    select 1 from public.tickets t
    where t.client_id = p_profile_id and not t.is_test
      and t.status in ('pending_confirmation', 'waiting', 'called', 'in_service')) then
    return 'active_ticket';
  end if;

  delete from private.ticket_contacts c
  using public.tickets t
  where c.ticket_id = t.id and t.client_id = p_profile_id;
  update public.tickets
  set display_name = 'Client', removal_note = null
  where client_id = p_profile_id;
  -- Cascades: profiles, then push_subscriptions; tickets.client_id and
  -- notifications.recipient_profile_id become null (K29).
  delete from auth.users where id = p_profile_id;
  return 'deleted';
end;
$$;

revoke execute on function public.account_export(uuid) from public, anon, authenticated;
revoke execute on function public.account_delete(uuid) from public, anon, authenticated;
grant execute on function public.account_export(uuid) to service_role;
grant execute on function public.account_delete(uuid) to service_role;
