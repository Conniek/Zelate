-- DEV-1 step 11/11: scheduled jobs (BACKEND_SCHEMA §10, times in UTC).
-- Edge Functions are called through pg_net with a shared secret. URL and
-- secret live in Vault (names: edge_functions_url, cron_secret); without them
-- (local dev, CI) the call is a silent no-op.

create function private.invoke_edge_function(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
end;
$$;

-- Retention (K40) and daily reset. Durations are to be confirmed by the GDPR review.
create function private.daily_maintenance()
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

revoke execute on function private.invoke_edge_function(text) from public, anon, authenticated;
revoke execute on function private.daily_maintenance() from public, anon, authenticated;

-- cron.schedule with a name replaces the job: the migration can be re-applied.
select cron.schedule('queue-tick', '* * * * *', $$select private.invoke_edge_function('queue-tick')$$);
select cron.schedule('send-notifications', '* * * * *', $$select private.invoke_edge_function('send-notifications')$$);
select cron.schedule('salon-daily-summary', '*/15 * * * *', $$select private.invoke_edge_function('salon-daily-summary')$$);
select cron.schedule('daily-maintenance', '30 1 * * *', $$select private.daily_maintenance()$$);
