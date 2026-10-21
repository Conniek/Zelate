begin;

-- Tests start from an empty database: drop the demo seed inside the transaction.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
delete from auth.users where id::text ~ '^00000000-0000-0000-0000-00000000[ac]00';
select plan(87);

-- Fixtures -------------------------------------------------------------
alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;
alter table public.services disable trigger services_log_settings;
alter table public.member_specialties disable trigger member_specialties_log_settings;
alter table public.opening_hours disable trigger opening_hours_log_settings;
alter table public.salon_closures disable trigger salon_closures_log_settings;

insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000003' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from unnest(array['01','02','03','04','05','06','07','08']) n;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000003' || n)::uuid, 'User' || n
from unnest(array['01','02','03','04','05','06','07','08']) n;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000308');

-- A is published, B is a draft.
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by)
values ('60000000-0000-0000-0000-0000000000a1', 'salon-a', 'Salon A', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111111', 'published', '00000000-0000-0000-0000-000000000301'),
       ('60000000-0000-0000-0000-0000000000b1', 'salon-b', 'Salon B', '+33622222222', '2 rue B', '69001', 'Lyon',
        'SRID=4326;POINT(4.83 45.76)', '22222222222222', 'draft', '00000000-0000-0000-0000-000000000304');

insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000301', 'manager', 'active', 'Mia', 'A', 'mia@a.test'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000302', 'stylist', 'active', 'Sam', 'A', 'sam@a.test'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000303', 'stylist', 'deactivated', 'Dan', 'A', 'dan@a.test'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000304', 'manager', 'active', 'Max', 'B', 'max@b.test'),
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000305', 'stylist', 'active', 'Sia', 'B', 'sia@b.test');

insert into public.member_specialties (member_id, specialty_code) values
  ('70000000-0000-0000-0000-000000000002', 'men_cut'), ('70000000-0000-0000-0000-000000000005', 'women_cut');
insert into public.opening_hours (salon_id, weekday, opens_at, closes_at) values
  ('60000000-0000-0000-0000-0000000000a1', 1, '09:00', '18:00'), ('60000000-0000-0000-0000-0000000000b1', 1, '09:00', '18:00');
insert into public.salon_closures (salon_id, starts_on, ends_on) values
  ('60000000-0000-0000-0000-0000000000a1', '2026-12-24', '2026-12-26'), ('60000000-0000-0000-0000-0000000000b1', '2026-12-24', '2026-12-26');
insert into public.services (salon_id, name, duration_minutes, price_cents) values
  ('60000000-0000-0000-0000-0000000000a1', 'Coupe A', 30, 2500), ('60000000-0000-0000-0000-0000000000b1', 'Coupe B', 30, 2500);
insert into public.stylist_presence (salon_id, member_id, service_date, status, status_since) values
  ('60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-000000000002', (now() at time zone 'Europe/Paris')::date, 'available', now()),
  ('60000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-000000000005', (now() at time zone 'Europe/Paris')::date, 'available', now());

insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
                            display_name, channel, planned_duration_minutes, queue_rank, client_id) values
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', '2026-10-21', 'AAAAA', 'tokA', 'xxxxxxxA', 'Awa', 'app', 30, 1, '00000000-0000-0000-0000-000000000306'),
  ('80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000b1', '2026-10-21', 'BBBBB', 'tokB', 'xxxxxxxB', 'Bob', 'app', 30, 1, '00000000-0000-0000-0000-000000000307');

insert into public.ticket_events (ticket_id, salon_id, type, actor_type, actor_member_id) values
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 'created', 'client', null),
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 'duration_adjusted', 'stylist', '70000000-0000-0000-0000-000000000002'),
  ('80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000b1', 'created', 'client', null);
insert into public.salon_events (salon_id, type, actor_type, actor_member_id) values
  ('60000000-0000-0000-0000-0000000000a1', 'queue_opened', 'manager', '70000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-0000000000a1', 'presence_changed', 'stylist', '70000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-0000000000b1', 'queue_opened', 'manager', '70000000-0000-0000-0000-000000000004');
insert into public.salon_verifications (salon_id, siret_check_result, siret_check_payload, checked_at) values
  ('60000000-0000-0000-0000-0000000000a1', 'valid', '{"raw": true}', now()),
  ('60000000-0000-0000-0000-0000000000b1', 'valid', '{"raw": true}', now());
insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth_secret) values
  ('00000000-0000-0000-0000-000000000306', 'https://push.test/1', 'k', 's'),
  ('00000000-0000-0000-0000-000000000307', 'https://push.test/2', 'k', 's');
insert into public.notifications (ticket_id, salon_id, recipient_profile_id, channel, template, params, dedupe_key, scheduled_at)
values ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000306',
        'push', 'ticket_created', '{}', 'k1', now());

alter table public.salons enable trigger salons_log_settings;
alter table public.salon_members enable trigger salon_members_log_settings;
alter table public.services enable trigger services_log_settings;
alter table public.member_specialties enable trigger member_specialties_log_settings;
alter table public.opening_hours enable trigger opening_hours_log_settings;
alter table public.salon_closures enable trigger salon_closures_log_settings;

create function pg_temp.changed(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

-- Helper functions --------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000301');
select is(private.managed_salon_id(), '60000000-0000-0000-0000-0000000000a1'::uuid, 'managed_salon_id: manager A manages A');
select is(private.staff_salon_id(), '60000000-0000-0000-0000-0000000000a1'::uuid, 'staff_salon_id: manager A');
select is(private.member_id(), '70000000-0000-0000-0000-000000000001'::uuid, 'member_id: manager A');
select is(private.is_platform_admin(), false, 'manager A is not a platform admin');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000302');
select is(private.managed_salon_id(), null, 'a stylist manages no salon');
select is(private.staff_salon_id(), '60000000-0000-0000-0000-0000000000a1'::uuid, 'stylist A works in A');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000303');
select is(private.staff_salon_id(), null, 'a deactivated stylist has no salon');
select is(private.member_id(), null, 'a deactivated stylist has no member id');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000308');
select is(private.is_platform_admin(), true, 'admin is recognised');
reset role;

-- Manager A: reads --------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000301');
select is((select array_agg(id) from public.salons), array['60000000-0000-0000-0000-0000000000a1'::uuid], 'manager A reads only salon A');
select is((select count(*)::int from public.salon_members where salon_id <> '60000000-0000-0000-0000-0000000000a1'), 0, 'manager A reads no member of B');
select is((select count(*)::int from public.salon_members), 3, 'manager A reads the 3 members of A');
select is((select count(*)::int from public.opening_hours where salon_id = '60000000-0000-0000-0000-0000000000b1'), 0, 'manager A reads no hours of B');
select is((select count(*)::int from public.salon_closures where salon_id = '60000000-0000-0000-0000-0000000000b1'), 0, 'manager A reads no closure of B');
select is((select count(*)::int from public.services where salon_id = '60000000-0000-0000-0000-0000000000b1'), 0, 'manager A reads no service of B');
select is((select count(*)::int from public.member_specialties where member_id = '70000000-0000-0000-0000-000000000005'), 0, 'manager A reads no specialty of B members');
select is((select count(*)::int from public.stylist_presence where salon_id = '60000000-0000-0000-0000-0000000000b1'), 0, 'manager A reads no presence of B');
select is((select count(*)::int from public.tickets), 0, 'manager A reads no ticket (RPC only, K32)');
select is((select count(*)::int from public.ticket_events where type is not null), 2, 'manager A reads the 2 ticket events of A only');
select is((select count(*)::int from public.salon_events), 2, 'manager A reads the 2 salon events of A only');
select is((select count(*)::int from public.salon_verifications), 1, 'manager A reads only the verification of A');
select is((select count(*)::int from public.notifications), 0, 'manager A reads no notification');
select is((select count(*)::int from public.push_subscriptions), 0, 'manager A reads no push subscription');
select is((select count(*)::int from public.platform_admins), 0, 'manager A reads no platform admin');
select is((select count(*)::int from public.profiles), 1, 'manager A reads only their profile');
select throws_ok('select tracking_token from public.tickets', '42501', null, 'tracking_token is not readable');
select throws_ok('select tracking_short_code from public.tickets', '42501', null, 'tracking_short_code is not readable');
select throws_ok('select siret_check_payload from public.salon_verifications', '42501', null, 'raw SIRET payload is not readable by the manager');
select throws_ok('select before from public.salon_events', '42501', null, 'event before/after are not readable directly');
select throws_ok('select * from private.ticket_contacts', '42501', null, 'manager cannot read private.ticket_contacts');
reset role;

-- Manager A: writes -------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000301');
select is(pg_temp.changed($q$update public.salons set name = 'Hack' where id = '60000000-0000-0000-0000-0000000000b1'$q$),
  0, 'manager A cannot update salon B');
select is(pg_temp.changed($q$update public.salons set welcome_message = 'Bienvenue' where id = '60000000-0000-0000-0000-0000000000a1'$q$),
  1, 'manager A updates welcome_message of A');
select throws_ok($$update public.salons set status = 'suspended' where id = '60000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'manager cannot change salon status (K32)');
select throws_ok($$update public.salons set qr_token = 'x' where id = '60000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'manager cannot change qr_token');
select throws_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents) values ('60000000-0000-0000-0000-0000000000b1', 'Intrus', 30, 1000)$$, '42501', null, 'manager A cannot create a service in B');
select lives_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents) values ('60000000-0000-0000-0000-0000000000a1', 'Secret price', 30, 1000)$$, 'manager A creates a service in A');
select is(pg_temp.changed($q$delete from public.services where salon_id = '60000000-0000-0000-0000-0000000000b1'$q$), 0, 'manager A cannot delete services of B');
select is(pg_temp.changed($q$update public.salon_members set first_name = 'Samuel' where id = '70000000-0000-0000-0000-000000000002'$q$), 1, 'manager A renames a stylist of A');
select is(pg_temp.changed($q$update public.salon_members set first_name = 'Hack' where id = '70000000-0000-0000-0000-000000000005'$q$), 0, 'manager A cannot rename a member of B');
select throws_ok($$update public.salon_members set role = 'manager' where id = '70000000-0000-0000-0000-000000000002'$$, '42501', null, 'manager cannot change a role');
select throws_ok($$insert into public.salon_members (salon_id, role, first_name, last_name, email) values ('60000000-0000-0000-0000-0000000000a1', 'stylist', 'X', 'Y', 'x@a.test')$$, '42501', null, 'members are created by the server only');
select throws_ok($$insert into public.member_specialties (member_id, specialty_code) values ('70000000-0000-0000-0000-000000000005', 'beard')$$, '42501', null, 'manager A cannot add a specialty to a member of B');
select lives_ok($$insert into public.member_specialties (member_id, specialty_code) values ('70000000-0000-0000-0000-000000000002', 'beard')$$, 'manager A adds a specialty to a member of A');
select throws_ok($$insert into public.tickets (salon_id, service_date, short_code, tracking_token, tracking_short_code, display_name, channel, planned_duration_minutes, queue_rank) values ('60000000-0000-0000-0000-0000000000a1', '2026-10-21', 'CCCCC', 't', 'xxxxxxxC', 'X', 'app', 30, 5)$$, '42501', null, 'tickets are written by the server only');
select throws_ok($$insert into public.salon_events (salon_id, type, actor_type) values ('60000000-0000-0000-0000-0000000000a1', 'queue_opened', 'manager')$$, '42501', null, 'logs are written by the server only');
reset role;

-- Settings log (K10): the fact, never the value ---------------------------
select is((select count(*)::int from public.salon_events
  where type = 'settings_updated' and salon_id = '60000000-0000-0000-0000-0000000000a1' and actor_type = 'manager'
    and actor_member_id = '70000000-0000-0000-0000-000000000001'), 4,
  'manager changes (salon, service, member name, specialty) are logged');
select is((select after from public.salon_events where type = 'settings_updated' and after ->> 'table' = 'salons'),
  '{"table": "salons", "columns": ["welcome_message"]}'::jsonb, 'the log names the column, not the value');
select is((select count(*)::int from public.salon_events where after::text like '%Secret price%' or after::text like '%Bienvenue%' or after::text like '%Samuel%'),
  0, 'no setting value is written to the log');
update public.salons set waiting_count = 3, queue_version = queue_version + 1 where id = '60000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.salon_events where type = 'settings_updated'), 4, 'server counters are not logged as settings');

-- Stylist A ----------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000302');
select is((select array_agg(id) from public.salons), array['60000000-0000-0000-0000-0000000000a1'::uuid], 'stylist A reads only salon A');
select is((select count(*)::int from public.tickets), 0, 'stylist A reads no ticket (RPC only, K32)');
select is((select count(*)::int from public.ticket_events), 1, 'stylist A reads only their own ticket actions');
select is((select count(*)::int from public.salon_events), 1, 'stylist A reads only their own salon actions');
select is((select count(*)::int from public.salon_verifications), 0, 'stylist A reads no verification');
select is(pg_temp.changed($q$update public.salon_members set photo_path = 'a/sam.webp' where id = '70000000-0000-0000-0000-000000000002'$q$), 1, 'stylist A changes their photo');
select throws_ok($$update public.salon_members set first_name = 'Hack' where id = '70000000-0000-0000-0000-000000000002'$$, '42501', null, 'stylist A cannot change their name (trigger)');
select is(pg_temp.changed($q$update public.salon_members set photo_path = 'x' where id = '70000000-0000-0000-0000-000000000001'$q$), 0, 'stylist A cannot change a colleague');
select is(pg_temp.changed($q$update public.salons set name = 'Hack' where id = '60000000-0000-0000-0000-0000000000a1'$q$), 0, 'stylist A cannot update the salon');
select throws_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents) values ('60000000-0000-0000-0000-0000000000a1', 'Intrus', 30, 1000)$$, '42501', null, 'stylist A cannot create a service');
reset role;

-- Deactivated stylist ------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000303');
select is((select count(*)::int from public.salons), 0, 'a deactivated stylist reads no salon');
select is((select count(*)::int from public.salon_members), 0, 'a deactivated stylist reads no member');
select is((select count(*)::int from public.stylist_presence), 0, 'a deactivated stylist reads no presence');
reset role;

-- Client 1 -----------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000306');
select is((select array_agg(id) from public.tickets), array['80000000-0000-0000-0000-000000000001'::uuid], 'client 1 reads only their ticket');
select is((select count(*)::int from public.ticket_events), 1, 'client 1 reads only displayable events of their ticket');
select is((select count(*)::int from public.salons), 0, 'client reads salons through public_salons only');
select is((select count(*)::int from public.salon_members), 0, 'client reads members through public_stylists only');
select is((select count(*)::int from public.push_subscriptions), 1, 'client reads only their push subscriptions');
select is(pg_temp.changed($q$update public.profiles set first_name = 'Awa2' where id = '00000000-0000-0000-0000-000000000306'$q$), 1, 'client updates their first name');
select throws_ok($$update public.profiles set is_guest = true where id = '00000000-0000-0000-0000-000000000306'$$, '42501', null, 'client cannot change is_guest (K32)');
select throws_ok($$update public.tickets set status = 'completed' where id = '80000000-0000-0000-0000-000000000001'$$, '42501', null, 'client cannot update a ticket');
reset role;

-- Anonymous visitor --------------------------------------------------------
set local role anon;
select throws_ok('select * from public.salons', '42501', null, 'anon has no right on salons');
select throws_ok('select * from public.tickets', '42501', null, 'anon has no right on tickets');
select throws_ok('select * from public.salon_members', '42501', null, 'anon has no right on salon_members');
select is((select array_agg(slug) from public.public_salons), array['salon-a'], 'public_salons lists published salons only');
select is((select array_agg(first_name) from public.public_stylists), array['Samuel'], 'public_stylists lists active stylists of published salons only');
select is((select presence from public.public_stylists), 'available', 'public_stylists exposes a simplified presence');
select is((select array_agg(name order by name) from public.services), array['Coupe A', 'Secret price'], 'anon reads services of published salons only');
select is((select count(*)::int from public.opening_hours), 1, 'anon reads hours of published salons only');
select is((select count(*)::int from public.salon_closures), 1, 'anon reads closures of published salons only');
select is((select count(*)::int from public.member_specialties), 2, 'anon reads specialties of published-salon members only');
select is((select count(*)::int from public.specialties), 10, 'anon reads the specialties list');
reset role;

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name in ('public_salons', 'public_stylists')
     and column_name in ('siret', 'qr_token', 'email', 'last_name', 'status', 'created_by', 'profile_id', 'naf_code')),
  0, 'public views expose no sensitive column');

-- Platform admin ------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000308');
select is((select count(*)::int from public.salons), 2, 'admin reads every salon');
select is((select count(*)::int from public.tickets), 2, 'admin reads every ticket');
select is((select count(*)::int from public.notifications), 1, 'admin reads notifications');
select throws_ok('select tracking_token from public.tickets', '42501', null, 'even the admin cannot read tracking tokens');
select is((select count(*)::int from public.platform_admins), 1, 'admin reads platform_admins');
reset role;

select * from finish();
rollback;
