-- DEV-4 step 1a: the daily maintenance also purges expired sign-up drafts (S-01 scenario 9).

create or replace function private.daily_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_counts jsonb := '{}'::jsonb;
  n integer;
begin
  update public.salon_members set served_today_count = 0 where served_today_count <> 0;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('served_today_reset', n);

  -- Expired drafts; a draft that already has history is kept.
  delete from public.salons s
  where s.status = 'draft' and s.draft_expires_at < now()
    and not exists (select 1 from public.salon_events e where e.salon_id = s.id);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('drafts_deleted', n);

  delete from private.signup_drafts where expires_at < now();
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('signup_drafts_deleted', n);

  delete from private.processed_commands where created_at < now() - interval '7 days';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('processed_commands', n);

  delete from public.notifications
  where status in ('sent', 'skipped') and created_at < now() - interval '30 days';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('notifications', n);

  delete from private.rate_limits where window_start < now() - interval '24 hours';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('rate_limits', n);

  delete from private.ticket_contacts where closed_at < now() - interval '24 hours';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('ticket_contacts', n);

  delete from private.no_show_records where occurred_at < now() - interval '30 days';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('no_show_records', n);

  delete from private.no_show_warnings where warned_at < now() - interval '30 days';
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('no_show_warnings', n);

  delete from public.push_subscriptions where expired_at is not null;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('push_subscriptions', n);

  -- Anonymisation after 12 months (K29): timestamps and durations stay for statistics.
  update public.tickets
  set display_name = 'Client', client_id = null, removal_note = null
  where service_date < ((now() at time zone 'Europe/Paris')::date - interval '12 months')
    and status in ('completed', 'cancelled', 'no_show')
    and (display_name <> 'Client' or client_id is not null or removal_note is not null);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('tickets_anonymised', n);

  return v_counts;
end;
$$;
