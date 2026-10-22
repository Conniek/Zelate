begin;

-- DEV-8 (F-C5, E13): the client's view of his ticket.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(7);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;

insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000007' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from unnest(array['01','02','03','04']) n;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000007' || n)::uuid, 'U' || n from unnest(array['01','02','03','04']) n;

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token)
values ('90000000-0000-0000-0000-0000000007a1', 'salon-view', 'Salon Vue', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111117', 'published', '00000000-0000-0000-0000-000000000701', 'qrVIEW');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('a0000000-0000-0000-0000-000000000701', '90000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000701', 'manager', 'active', 'Mia', 'A', 'mia@view.test'),
  ('a0000000-0000-0000-0000-000000000702', '90000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000702', 'stylist', 'active', 'Sam', 'A', 'sam@view.test');

-- Two clients waiting for Sam: Awa first, then Bob.
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id, estimated_member_id, status, estimated_start_at)
values
  ('b0000000-0000-0000-0000-000000000701', '90000000-0000-0000-0000-0000000007a1', (now() at time zone 'Europe/Paris')::date,
   'AAAAA', 'tokView1', 'xxxxxxV1', 'Awa', 'app', 30, 1, '00000000-0000-0000-0000-000000000703',
   'a0000000-0000-0000-0000-000000000702', 'waiting', now() + interval '10 minutes'),
  ('b0000000-0000-0000-0000-000000000702', '90000000-0000-0000-0000-0000000007a1', (now() at time zone 'Europe/Paris')::date,
   'BBBBB', 'tokView2', 'xxxxxxV2', 'Bob', 'app', 30, 2, '00000000-0000-0000-0000-000000000704',
   'a0000000-0000-0000-0000-000000000702', 'waiting', now() + interval '40 minutes');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

set local role anon;
select throws_ok('select public.my_ticket()', '42501', null, 'anon cannot call my_ticket');
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000704');
select is(public.my_ticket() -> 'ticket' ->> 'short_code', 'BBBBB', 'my_ticket returns the client''s own ticket');
select is((public.my_ticket() -> 'ticket' ->> 'position')::int, 1, 'position counts the clients before him at his stylist (E13)');
select ok(not (public.my_ticket()::text ~ 'tokView|xxxxxxV'), 'my_ticket never returns the tracking token or link');
select is(public.my_ticket() -> 'salon' ->> 'name', 'Salon Vue', 'my_ticket includes the salon');
reset role;

-- A ticket that ended today is still shown, to explain how it ended.
update public.tickets set status = 'cancelled', cancelled_at = now(), cancel_reason = 'client_cancelled'
where id = 'b0000000-0000-0000-0000-000000000702';
select pg_temp.login('00000000-0000-0000-0000-000000000704');
select is(public.my_ticket() -> 'ticket' ->> 'cancel_reason', 'client_cancelled', 'an ended ticket of today is returned with its reason');
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000702');
select is(public.my_ticket(), null, 'someone without a ticket today gets nothing');
reset role;

select * from finish();
rollback;
