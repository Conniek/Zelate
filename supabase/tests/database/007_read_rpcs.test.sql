begin;

-- Tests start from an empty database: drop the demo seed inside the transaction.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
delete from auth.users where id::text ~ '^00000000-0000-0000-0000-00000000[ac]00';
select plan(32);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;
alter table public.services disable trigger services_log_settings;
alter table public.opening_hours disable trigger opening_hours_log_settings;

insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000004' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from unnest(array['01','02','03','04','05']) n;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000004' || n)::uuid, 'U' || n from unnest(array['01','02','03','04','05']) n;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000405');

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token, waiting_count, current_wait_minutes)
values ('90000000-0000-0000-0000-0000000000a1', 'salon-a', 'Salon A', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111111', 'published', '00000000-0000-0000-0000-000000000401', 'qrA', 1, 20),
       ('90000000-0000-0000-0000-0000000000b1', 'salon-b', 'Salon B', '+33622222222', '2 rue B', '69001', 'Lyon',
        'SRID=4326;POINT(4.83 45.76)', '22222222222222', 'published', '00000000-0000-0000-0000-000000000404', 'qrB', 0, null),
       ('90000000-0000-0000-0000-0000000000c1', 'salon-c', 'Salon C', '+33633333333', '3 rue C', '75002', 'Paris',
        'SRID=4326;POINT(2.36 48.86)', '33333333333333', 'draft', '00000000-0000-0000-0000-000000000401', 'qrC', 0, null);
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000401', 'manager', 'active', 'Mia', 'A', 'mia@a.test'),
  ('a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000402', 'stylist', 'active', 'Sam', 'A', 'sam@a.test'),
  ('a0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000404', 'manager', 'active', 'Max', 'B', 'max@b.test');
insert into public.stylist_presence (salon_id, member_id, service_date, status, status_since) values
  ('90000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000002', (now() at time zone 'Europe/Paris')::date, 'available', now());
insert into public.services (salon_id, name, duration_minutes, price_cents) values
  ('90000000-0000-0000-0000-0000000000a1', 'Coupe', 30, 2500);
insert into public.opening_hours (salon_id, weekday, opens_at, closes_at) values
  ('90000000-0000-0000-0000-0000000000a1', 1, '09:00', '18:00');

insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id, requested_member_id, estimated_member_id,
  status, assigned_member_id, called_at, completed_at, started_at, arrived_at, initial_estimated_start_at) values
  ('b0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', (now() at time zone 'Europe/Paris')::date, 'AAAAA', 'tokA', 'xxxxxxxA', 'Awa', 'app', 30, 1,
   '00000000-0000-0000-0000-000000000403', null, 'a0000000-0000-0000-0000-000000000002', 'waiting', null, null, null, null, null, null),
  ('b0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b1', (now() at time zone 'Europe/Paris')::date, 'BBBBB', 'tokB', 'xxxxxxxB', 'Bob', 'app', 30, 1,
   null, null, null, 'waiting', null, null, null, null, null, null);
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, status, assigned_member_id, completed_at, started_at, arrived_at, initial_estimated_start_at, created_at)
values ('b0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000a1', (now() at time zone 'Europe/Paris')::date, 'CCCCC', 'tokC', 'xxxxxxxC', 'Cle', 'front_desk', 30, 2,
   'completed', 'a0000000-0000-0000-0000-000000000002', now(), now() - interval '10 minutes', now() - interval '20 minutes', now() - interval '40 minutes', now() - interval '50 minutes');

insert into public.salon_events (salon_id, type, actor_type, actor_member_id) values
  ('90000000-0000-0000-0000-0000000000a1', 'queue_opened', 'manager', 'a0000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-0000000000b1', 'queue_opened', 'manager', 'a0000000-0000-0000-0000-000000000003');
insert into public.ticket_events (ticket_id, salon_id, type, actor_type) values
  ('b0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1', 'created', 'client');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Public RPCs --------------------------------------------------------------
set local role anon;
select is((select array_agg(slug) from public.search_salons(48.85, 2.35)), array['salon-a'], 'search_salons: published salons within 5 km, sorted by distance');
select is((select array_agg(slug) from public.search_salons(48.85, 2.35, 500000)), array['salon-a'], 'search_salons: a wide radius is capped, Lyon stays out');
select is((select count(*)::int from public.search_salons(48.85, 2.35, 99999999)), 1, 'search_salons: radius is capped at 20 km');
select is((select count(*)::int from public.search_salons(48.85, 2.35, 5000, 'nothing')), 0, 'search_salons: text filter');
select is((public.get_salon_public('salon-a') -> 'salon' ->> 'name'), 'Salon A', 'get_salon_public returns the salon');
select is((public.get_salon_public('salon-a') ->> 'waiting_count')::int, 1, 'get_salon_public returns the number of clients waiting (E31)');
select is(jsonb_array_length(public.get_salon_public('salon-a') -> 'services'), 1, 'get_salon_public returns the services');
select is(jsonb_array_length(public.get_salon_public('salon-a') -> 'stylists'), 1, 'get_salon_public returns the stylists');
select is(public.get_salon_public('salon-c'), null, 'get_salon_public hides a draft salon');
select ok(not (public.get_salon_public('salon-a')::text ~ '(siret|qr_token|tracking|@a.test|"A")'), 'get_salon_public leaks no sensitive field');
select is(public.resolve_qr_token('qrA'), 'salon-a', 'resolve_qr_token resolves a published salon');
select is(public.resolve_qr_token('qrC'), null, 'resolve_qr_token ignores a draft salon');
select throws_ok('select public.my_active_ticket()', '42501', null, 'anon cannot call my_active_ticket');
select throws_ok('select public.get_stylist_queue()', '42501', null, 'anon cannot call get_stylist_queue');
select throws_ok($$select public.get_salon_board('90000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'anon cannot call get_salon_board');
reset role;

-- Client ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000403');
select is(public.my_active_ticket() -> 'ticket' ->> 'short_code', 'AAAAA', 'my_active_ticket returns the client ticket');
select is(public.my_active_ticket() -> 'salon' ->> 'slug', 'salon-a', 'my_active_ticket includes the salon');
select ok(not (public.my_active_ticket()::text ~ 'tok|xxxxxxx'), 'my_active_ticket never returns the tracking token');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000402');
select is(public.my_active_ticket(), null, 'my_active_ticket is null without an active ticket');

-- Stylist ----------------------------------------------------------------------
select is(jsonb_array_length(public.get_stylist_queue() -> 'next'), 1, 'get_stylist_queue lists the clients pending for this stylist');
select ok(not (public.get_stylist_queue()::text ~ 'tok|xxxxxxx|phone'), 'get_stylist_queue returns no token or phone');
select throws_ok($$select public.get_salon_board('90000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'a stylist cannot read the board (manager only, K9)');
select is((public.get_day_summary('90000000-0000-0000-0000-0000000000a1', (now() at time zone 'Europe/Paris')::date) ->> 'served_count')::int, 1, 'a stylist reads their own day summary');
select throws_ok($$select public.get_day_summary('90000000-0000-0000-0000-0000000000b1', current_date)$$, '42501', null, 'a stylist cannot read the summary of another salon');
select throws_ok($$select public.get_audit_log()$$, '42501', null, 'a stylist cannot read the audit log');
reset role;

-- Manager ----------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000401');
select is(jsonb_array_length(public.get_salon_board('90000000-0000-0000-0000-0000000000a1') -> 'tickets'), 1, 'get_salon_board lists the active tickets');
select ok(not (public.get_salon_board('90000000-0000-0000-0000-0000000000a1')::text ~ 'tok|xxxxxxx|no_show_count'), 'get_salon_board returns no token and no absence counter (E28)');
select throws_ok($$select public.get_salon_board('90000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'a manager cannot read the board of another salon');
select is(jsonb_array_length(public.get_audit_log() -> 'events'), 2, 'get_audit_log returns the events of the own salon only');
select is((select e ->> 'actor_first_name' from jsonb_array_elements(public.get_audit_log() -> 'events') e where e ->> 'type' = 'queue_opened'), 'Mia', 'get_audit_log gives the first name of the acting member');
select throws_ok($$select public.get_audit_log('90000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'a manager cannot read the audit log of another salon');
select is((public.get_day_summary('90000000-0000-0000-0000-0000000000a1', (now() at time zone 'Europe/Paris')::date) ->> 'actual_wait_minutes')::int, 40, 'get_day_summary: actual wait');
reset role;

select * from finish();
rollback;
