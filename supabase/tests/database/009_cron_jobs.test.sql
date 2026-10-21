begin;

-- Tests start from an empty database: drop the demo seed inside the transaction.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
delete from auth.users where id::text ~ '^00000000-0000-0000-0000-00000000[ac]00';
select plan(17);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;

select is((select count(*)::int from cron.job where jobname in ('queue-tick', 'send-notifications', 'salon-daily-summary', 'daily-maintenance')), 4, 'the 4 jobs are scheduled');
select is((select schedule from cron.job where jobname = 'queue-tick'), '* * * * *', 'queue-tick runs every minute');
select is((select schedule from cron.job where jobname = 'send-notifications'), '* * * * *', 'send-notifications runs every minute');
select is((select schedule from cron.job where jobname = 'salon-daily-summary'), '*/15 * * * *', 'salon-daily-summary runs every 15 minutes');
select is((select schedule from cron.job where jobname = 'daily-maintenance'), '30 1 * * *', 'daily-maintenance runs at 01:30 UTC');
select lives_ok($$select private.invoke_edge_function('queue-tick')$$, 'calling an Edge Function without Vault secrets is a no-op');
select ok(
  not has_function_privilege('authenticated', 'private.daily_maintenance()', 'execute')
  and not has_function_privilege('anon', 'private.invoke_edge_function(text)', 'execute'),
  'API roles cannot run the maintenance or call Edge Functions');

insert into auth.users (id, instance_id, aud, role)
values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.profiles (id, first_name) values
  ('00000000-0000-0000-0000-000000000601', 'Mia'), ('00000000-0000-0000-0000-000000000602', 'Awa');
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, draft_expires_at) values
  ('f0000000-0000-0000-0000-0000000000a1', 'salon-a', 'Salon A', '+33611111111', '1 rue A', '75001', 'Paris', 'SRID=4326;POINT(2.35 48.85)', '11111111111111', 'published', '00000000-0000-0000-0000-000000000601', null),
  ('f0000000-0000-0000-0000-0000000000d1', 'draft-old', 'Draft old', '+33622222222', '2 rue D', '75002', 'Paris', 'SRID=4326;POINT(2.35 48.85)', '22222222222222', 'draft', '00000000-0000-0000-0000-000000000601', now() - interval '1 day'),
  ('f0000000-0000-0000-0000-0000000000d2', 'draft-new', 'Draft new', '+33633333333', '3 rue D', '75003', 'Paris', 'SRID=4326;POINT(2.35 48.85)', '33333333333333', 'draft', '00000000-0000-0000-0000-000000000601', now() + interval '1 day');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email, served_today_count) values
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000601', 'manager', 'active', 'Mia', 'A', 'mia@a.test', 7);

insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code, display_name, channel,
  planned_duration_minutes, queue_rank, client_id, status, cancelled_at, cancel_reason, removal_reason, removal_note) values
  ('f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a1', current_date - 400, 'AAAAA', 'tokA', 'xxxxxxxA', 'Awa', 'app', 30, 1,
   '00000000-0000-0000-0000-000000000602', 'cancelled', now(), 'removed_by_salon', 'emergency', 'note'),
  ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', current_date - 10, 'BBBBB', 'tokB', 'xxxxxxxB', 'Bea', 'app', 30, 1,
   null, 'waiting', null, null, null, null);
insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active, closed_at) values
  ('f2000000-0000-0000-0000-000000000001', '+33612345678', '\x01', false, now() - interval '2 days'),
  ('f2000000-0000-0000-0000-000000000002', '+33687654321', '\x02', true, null);
insert into private.processed_commands (command_id, command, response, created_at) values
  (gen_random_uuid(), 'join_queue', '{}', now() - interval '8 days'), (gen_random_uuid(), 'join_queue', '{}', now());
insert into private.rate_limits (bucket, key_hash, window_start, count) values
  ('sms', '\x01', now() - interval '25 hours', 1), ('sms', '\x02', now(), 1);
insert into private.no_show_records (phone_hash, ticket_id, occurred_at) values
  ('\x01', gen_random_uuid(), now() - interval '31 days'), ('\x01', gen_random_uuid(), now() - interval '2 days');
insert into private.no_show_warnings (phone_hash, warned_at) values ('\x01', now() - interval '31 days'), ('\x02', now());
insert into public.notifications (ticket_id, salon_id, channel, template, params, dedupe_key, status, scheduled_at, created_at) values
  ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', 'push', 'ticket_created', '{}', 'k1', 'sent', now(), now() - interval '31 days'),
  ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', 'push', 'get_ready', '{}', 'k2', 'pending', now(), now() - interval '31 days'),
  ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', 'push', 'your_turn', '{}', 'k3', 'sent', now(), now());
insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth_secret, expired_at) values
  ('00000000-0000-0000-0000-000000000601', 'https://push.test/old', 'k', 's', now()),
  ('00000000-0000-0000-0000-000000000601', 'https://push.test/live', 'k', 's', null);

select private.daily_maintenance();

select is((select served_today_count from public.salon_members where id = 'f1000000-0000-0000-0000-000000000001'), 0, 'served_today_count is reset');
select is((select array_agg(slug order by slug) from public.salons where status = 'draft'), array['draft-new'], 'only expired drafts are deleted');
select is((select count(*)::int from private.processed_commands), 1, 'processed_commands older than 7 days are purged');
select is((select count(*)::int from private.rate_limits), 1, 'rate_limits older than 24 h are purged');
select is((select array_agg(ticket_id) from private.ticket_contacts), array['f2000000-0000-0000-0000-000000000002'::uuid], 'closed contacts are purged, active ones kept');
select is((select count(*)::int from private.no_show_records) + (select count(*)::int from private.no_show_warnings), 2, 'no-show records and warnings older than 30 days are purged');
select is((select array_agg(status order by dedupe_key) from public.notifications), array['pending'::public.notification_status, 'sent'], 'old sent notifications are purged, pending ones kept');
select is((select array_agg(endpoint) from public.push_subscriptions), array['https://push.test/live'], 'expired push subscriptions are purged');
select is((select display_name || '/' || coalesce(client_id::text, 'null') || '/' || coalesce(removal_note, 'null') from public.tickets where id = 'f2000000-0000-0000-0000-000000000001'),
  'Client/null/null', 'tickets older than 12 months are anonymised');
select is((select display_name from public.tickets where id = 'f2000000-0000-0000-0000-000000000002'), 'Bea', 'recent tickets are untouched');

select * from finish();
rollback;
