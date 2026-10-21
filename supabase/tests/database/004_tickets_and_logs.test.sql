begin;

-- Tests start from an empty database: drop the demo seed inside the transaction.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
delete from auth.users where id::text ~ '^00000000-0000-0000-0000-00000000[ac]00';
select plan(42);

select has_table('public', t, t || ' exists')
from unnest(array['stylist_presence', 'tickets', 'ticket_events', 'salon_events',
                  'notifications', 'push_subscriptions', 'salon_verifications']) as t;
select is(
  (select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace
   and c.relname in ('stylist_presence', 'tickets', 'ticket_events', 'salon_events',
     'notifications', 'push_subscriptions', 'salon_verifications') and c.relrowsecurity),
  7, 'RLS is enabled on the seven tables'
);

-- Fixtures: one salon, a manager, two stylists, two clients.
insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from generate_series(1, 5) i;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'P' || i
from generate_series(1, 5) i;
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, created_by)
values ('20000000-0000-0000-0000-000000000001', 'salon-t', 'Salon T', '+33612345678', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '12345678901234', '00000000-0000-0000-0000-000000000101');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'manager', 'active', 'M', 'M', 'm@example.com'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'stylist', 'active', 'S1', 'S', 's1@example.com'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 'stylist', 'active', 'S2', 'S', 's2@example.com');

-- stylist_presence
insert into public.stylist_presence (salon_id, member_id, service_date, status_since)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-10-21', now());
select throws_ok(
  $$insert into public.stylist_presence (salon_id, member_id, service_date, status_since)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-10-21', now())$$,
  '23505', null, 'one presence row per member and day');
select is((select status::text from public.stylist_presence limit 1), 'offline', 'presence defaults to offline');

-- helper to insert tickets with overrides
create function pg_temp.t(p_n int, p_cols text default '', p_vals text default '')
returns void language plpgsql as $f$
begin
  execute format(
    $q$insert into public.tickets (salon_id, service_date, short_code, tracking_token, tracking_short_code,
         display_name, channel, planned_duration_minutes, queue_rank %s)
       values ('20000000-0000-0000-0000-000000000001', '2026-10-21', %L, 'tok' || %s, %L,
         'Awa', 'app', 30, %s %s)$q$,
    case when p_cols = '' then '' else ', ' || p_cols end,
    'AAAA' || (array['A','B','C','D','E','F','G','H','J','K'])[p_n],
    p_n, lpad(p_n::text, 8, 'x'), p_n,
    case when p_vals = '' then '' else ', ' || p_vals end);
end $f$;

select lives_ok($$select pg_temp.t(1, 'client_id', '''00000000-0000-0000-0000-000000000104''')$$, 'a queue ticket can be created');
select is((select status::text from public.tickets where short_code = 'AAAAA'), 'waiting', 'status defaults to waiting');
select throws_ok($$select pg_temp.t(2, 'client_id', '''00000000-0000-0000-0000-000000000104''')$$, '23505', null, 'one active ticket per client');
select lives_ok($$select pg_temp.t(2, 'client_id, is_test', '''00000000-0000-0000-0000-000000000104'', true')$$, 'test tickets are exempt from the one-active rule');
select throws_ok(
  $$insert into public.tickets (salon_id, service_date, short_code, tracking_token, tracking_short_code,
      display_name, channel, planned_duration_minutes, queue_rank)
    values ('20000000-0000-0000-0000-000000000001', '2026-10-21', 'AAAAO', 'tokO', 'xxxxxxxO', 'Awa', 'app', 30, 9)$$,
  '23514', null, 'a short code with the letter O is rejected');
select throws_ok($$select pg_temp.t(1)$$, '23505', null, 'a duplicate short code in the same salon and day is rejected');
select throws_ok($$select pg_temp.t(3, 'postpone_count', '3')$$, '23514', null, 'postpone_count is capped at 2');

-- status/timestamp coherence
select throws_ok($$select pg_temp.t(3, 'status', '''called''')$$, '23514', null, 'called requires called_at (and a stylist)');
select throws_ok($$select pg_temp.t(3, 'status, called_at', '''called'', now()')$$, '23514', null, 'called requires an assigned stylist');
select lives_ok($$select pg_temp.t(3, 'status, called_at, assigned_member_id', '''called'', now(), ''30000000-0000-0000-0000-000000000002''')$$, 'a called ticket with stylist and timestamp is valid');
select throws_ok($$select pg_temp.t(4, 'status, called_at, assigned_member_id', '''called'', now(), ''30000000-0000-0000-0000-000000000002''')$$, '23505', null, 'one called or in-service ticket per stylist');
select throws_ok($$select pg_temp.t(4, 'status, started_at, assigned_member_id', '''in_service'', now(), ''30000000-0000-0000-0000-000000000003''')$$, '23514', null, 'in_service requires arrived_at (H7)');
select throws_ok($$select pg_temp.t(4, 'status', '''cancelled''')$$, '23514', null, 'cancelled requires a timestamp and a reason');
select throws_ok($$select pg_temp.t(4, 'status, cancelled_at, cancel_reason', '''cancelled'', now(), ''removed_by_salon''')$$, '23514', null, 'removed_by_salon requires a removal_reason');
select lives_ok($$select pg_temp.t(4, 'status, cancelled_at, cancel_reason, removal_reason', '''cancelled'', now(), ''removed_by_salon'', ''emergency''')$$, 'a removal with its reason is valid');
select throws_ok($$select pg_temp.t(5, 'called_at', 'now()')$$, '23514', null, 'call fields must be empty outside the called status (K31)');
select throws_ok($$select pg_temp.t(5, 'eta_response', '''late''')$$, '23514', null, 'a late response needs a declared delay');
select throws_ok($$select pg_temp.t(5, 'reassignment_member_id', '''30000000-0000-0000-0000-000000000003''')$$, '23514', null, 'reassignment columns are all set or all empty');

-- appointments
select throws_ok($$select pg_temp.t(5, 'kind', '''appointment''')$$, '23514', null, 'an appointment needs scheduled_at and its source');
select lives_ok($$select pg_temp.t(5, 'kind, scheduled_at, appointment_source, assigned_member_id', '''appointment'', now() + interval ''1 day'', ''salon_entry'', ''30000000-0000-0000-0000-000000000003''')$$, 'a salon appointment with a stylist is valid');
select throws_ok($$select pg_temp.t(6, 'kind, scheduled_at, appointment_source', '''appointment'', now() + interval ''1 day'', ''salon_entry''')$$, '23514', null, 'a waiting appointment must have a stylist');
select throws_ok($$select pg_temp.t(6, 'kind, scheduled_at, appointment_source, status', '''appointment'', now() + interval ''1 day'', ''salon_entry'', ''pending_confirmation''')$$, '23514', null, 'pending_confirmation only for client check-ins');
select lives_ok($$select pg_temp.t(6, 'kind, scheduled_at, appointment_source, status', '''appointment'', now() + interval ''1 day'', ''client_check_in'', ''pending_confirmation''')$$, 'a pending client check-in is valid without stylist');

-- audit logs are append-only
insert into public.ticket_events (ticket_id, salon_id, type, actor_type)
select id, salon_id, 'created', 'system' from public.tickets where short_code = 'AAAAA';
select throws_ok($$update public.ticket_events set reason_code = 'x'$$, '42501', null, 'ticket_events cannot be updated');
select throws_ok($$delete from public.ticket_events$$, '42501', null, 'ticket_events cannot be deleted');
select throws_ok(
  $$insert into public.ticket_events (ticket_id, salon_id, type, actor_type, reason_code)
    select id, salon_id, 'created', 'system', 'Free text!' from public.tickets limit 1$$,
  '23514', null, 'reason_code must be a structured code');
insert into public.salon_events (salon_id, type, actor_type)
values ('20000000-0000-0000-0000-000000000001', 'queue_opened', 'manager');
select throws_ok($$delete from public.salon_events$$, '42501', null, 'salon_events cannot be deleted');

-- notifications deduplication
insert into public.notifications (ticket_id, salon_id, channel, template, dedupe_key)
select id, salon_id, 'sms', 'your_turn', 'your_turn:1' from public.tickets where short_code = 'AAAAA';
select throws_ok(
  $$insert into public.notifications (ticket_id, salon_id, channel, template, dedupe_key)
    select id, salon_id, 'sms', 'your_turn', 'your_turn:1' from public.tickets where short_code = 'AAAAA'$$,
  '23505', null, 'the same ticket notification is never doubled');
insert into public.notifications (salon_id, recipient_member_id, channel, template, dedupe_key)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'email', 'daily_summary', 'daily_summary:2026-10-21');
select throws_ok(
  $$insert into public.notifications (salon_id, channel, template, dedupe_key)
    values ('20000000-0000-0000-0000-000000000001', 'email', 'daily_summary', 'daily_summary:2026-10-21')$$,
  '23505', null, 'staff e-mails without ticket are deduplicated per salon (K37)');

-- push subscriptions: exactly one owner
select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth_secret) values ('https://e/1', 'k', 'a')$$,
  '23514', null, 'a push subscription needs an owner');
select throws_ok(
  $$insert into public.push_subscriptions (profile_id, member_id, endpoint, p256dh, auth_secret)
    values ('00000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-000000000001', 'https://e/2', 'k', 'a')$$,
  '23514', null, 'a push subscription has exactly one owner');

-- verifications
select throws_ok(
  $$insert into public.salon_verifications (salon_id, siret_check_result, checked_at, decision)
    values ('20000000-0000-0000-0000-000000000001', 'valid', now(), 'rejected')$$,
  '23514', null, 'a rejection needs a reason');

select * from finish();
rollback;
