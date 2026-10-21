begin;

-- F-M12 (S-15): the board carries the closing time and the end-of-day answers.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(6);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;
alter table public.opening_hours disable trigger opening_hours_log_settings;
alter table public.salon_closures disable trigger salon_closures_log_settings;

insert into auth.users (id, instance_id, aud, role) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-000000000601', 'Mia');

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token)
values ('90000000-0000-0000-0000-0000000006a1', 'salon-eod', 'Salon EOD', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111116', 'published', '00000000-0000-0000-0000-000000000601', 'qrEOD');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email) values
  ('a0000000-0000-0000-0000-000000000601', '90000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-000000000601', 'manager', 'active', 'Mia', 'A', 'mia@eod.test');

-- Two ranges today: the last closing is the latest one.
insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
select '90000000-0000-0000-0000-0000000006a1', extract(isodow from (now() at time zone 'Europe/Paris')::date)::smallint, o, c
from (values ('08:00'::time, '12:00'::time), ('14:00'::time, '19:30'::time)) v(o, c);

insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, status, end_of_day_warned_at, end_of_day_choice)
values ('b0000000-0000-0000-0000-000000000601', '90000000-0000-0000-0000-0000000006a1', (now() at time zone 'Europe/Paris')::date,
  'EEEEE', 'tokE', 'xxxxxxxE', 'Eva', 'app', 30, 1, 'waiting', now(), 'stay');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-000000000601');
select is(
  (public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'indicators' ->> 'last_closing_at')::timestamptz,
  ((now() at time zone 'Europe/Paris')::date + '19:30'::time) at time zone 'Europe/Paris',
  'the board gives the last closing of today, in Paris');
select is((public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'indicators' ->> 'end_of_day_warning_minutes')::int, 120,
  'the board gives the warning window');
select is((public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'indicators' ->> 'closing_grace_minutes')::int, 15,
  'the board gives the grace before the automatic cancellation');
select is(public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'tickets' -> 0 ->> 'end_of_day_choice', 'stay',
  'each ticket carries the client''s end-of-day answer');
select ok(public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'tickets' -> 0 ? 'closing_decision',
  'each ticket carries the manager''s closing decision');
reset role;

insert into public.salon_closures (salon_id, starts_on, ends_on)
values ('90000000-0000-0000-0000-0000000006a1', (now() at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date);
select pg_temp.login('00000000-0000-0000-0000-000000000601');
select is(public.get_salon_board('90000000-0000-0000-0000-0000000006a1') -> 'indicators' ->> 'last_closing_at', null,
  'no closing time on a closure day');
reset role;

select * from finish();
rollback;
