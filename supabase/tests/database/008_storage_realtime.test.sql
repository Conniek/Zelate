begin;
select plan(22);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;

insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000005' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from unnest(array['01','02','03']) n;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000005' || n)::uuid, 'U' || n from unnest(array['01','02','03']) n;
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by) values
  ('c0000000-0000-0000-0000-0000000000a1', 'salon-a', 'Salon A', '+33611111111', '1 rue A', '75001', 'Paris', 'SRID=4326;POINT(2.35 48.85)', '11111111111111', 'published', '00000000-0000-0000-0000-000000000501'),
  ('c0000000-0000-0000-0000-0000000000b1', 'salon-b', 'Salon B', '+33622222222', '2 rue B', '69001', 'Lyon', 'SRID=4326;POINT(4.83 45.76)', '22222222222222', 'published', '00000000-0000-0000-0000-000000000503');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000501', 'manager', 'active', 'Mia', 'A', 'mia@a.test'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000503', 'manager', 'active', 'Max', 'B', 'max@b.test');
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000a1', '2026-10-21', 'AAAAA', 'tokA', 'xxxxxxxA', 'Awa', 'app', 30, 1, '00000000-0000-0000-0000-000000000502');

insert into realtime.messages (topic, extension, event, payload, private) values
  ('salon:c0000000-0000-0000-0000-0000000000a1', 'broadcast', 'queue_updated', '{"version":1}', true),
  ('salon:c0000000-0000-0000-0000-0000000000b1', 'broadcast', 'queue_updated', '{"version":1}', true),
  ('ticket:e0000000-0000-0000-0000-000000000001', 'broadcast', 'ticket_updated', '{"version":1}', true),
  ('salon-public:c0000000-0000-0000-0000-0000000000a1', 'broadcast', 'salon_updated', '{"version":1}', true),
  ('ticket-token:0123456789abcdef0123456789abcdef', 'broadcast', 'ticket_updated', '{"version":1}', true),
  ('salon:not-a-uuid', 'broadcast', 'queue_updated', '{}', true);

select is(
  (select array_agg(id order by id) from storage.buckets where id in ('salon-photos', 'member-photos', 'qr-posters')),
  array['member-photos', 'qr-posters', 'salon-photos'], 'the 3 buckets exist');
select is((select public from storage.buckets where id = 'salon-photos'), true, 'salon-photos is public');
select is((select public from storage.buckets where id = 'qr-posters'), false, 'qr-posters is private');
select is((select file_size_limit from storage.buckets where id = 'salon-photos'), 307200::bigint, 'salon photos are limited to 300 KB');
select is(private.storage_salon_folder('not-a-uuid/photo.webp'), null, 'a non-uuid folder maps to null');
select is(private.topic_uuid('ticket:not-a-uuid', 'ticket'), null, 'a malformed topic maps to null');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Storage: manager A ---------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000501');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('salon-photos', 'c0000000-0000-0000-0000-0000000000a1/front.webp', '00000000-0000-0000-0000-000000000501')$$, 'manager A uploads to their salon folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('salon-photos', 'c0000000-0000-0000-0000-0000000000b1/hack.webp')$$, '42501', null, 'manager A cannot upload to the folder of salon B');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('member-photos', 'whatever.webp')$$, '42501', null, 'a path outside a salon folder is refused');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('qr-posters', 'c0000000-0000-0000-0000-0000000000a1/qr.pdf')$$, 'manager A stores their QR poster');
select is((select count(*)::int from storage.objects), 2, 'manager A lists only their own objects');
reset role;

insert into storage.objects (bucket_id, name) values ('qr-posters', 'c0000000-0000-0000-0000-0000000000b1/qr.pdf');

select pg_temp.login('00000000-0000-0000-0000-000000000501');
select is((select count(*)::int from storage.objects where bucket_id = 'qr-posters'), 1, 'manager A does not see the QR poster of B');
select is((select count(*)::int from (select 1 from storage.objects where name like 'c0000000-0000-0000-0000-0000000000b1/%') x), 0, 'manager A reads nothing of salon B');
reset role;

set local role anon;
select is((select count(*)::int from storage.objects), 0, 'anon lists no object through the API');
reset role;

-- Realtime ---------------------------------------------------------------------
create function pg_temp.visible(p_topic text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('realtime.topic', p_topic, true);
  select count(*)::int into n from realtime.messages where topic = p_topic;
  return n;
end $$;

set local role anon;
select is(pg_temp.visible('salon-public:c0000000-0000-0000-0000-0000000000a1'), 1, 'anon receives the public salon channel');
select is(pg_temp.visible('ticket-token:0123456789abcdef0123456789abcdef'), 1, 'anon receives a token channel');
select is(pg_temp.visible('salon:c0000000-0000-0000-0000-0000000000a1'), 0, 'anon receives no staff channel');
select is(pg_temp.visible('ticket:e0000000-0000-0000-0000-000000000001'), 0, 'anon receives no ticket channel');
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000501');
select is(pg_temp.visible('salon:c0000000-0000-0000-0000-0000000000a1'), 1, 'manager A receives the channel of their salon');
select is(pg_temp.visible('salon:c0000000-0000-0000-0000-0000000000b1'), 0, 'manager A receives no channel of salon B');
select is(pg_temp.visible('salon:not-a-uuid'), 0, 'a malformed topic is refused');
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000502');
select is(pg_temp.visible('ticket:e0000000-0000-0000-0000-000000000001'), 1, 'the client receives the channel of their ticket');
reset role;

select * from finish();
rollback;
