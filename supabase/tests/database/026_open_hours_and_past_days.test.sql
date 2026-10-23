begin;

-- Client reads follow the opening hours; no place outlives its day.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(11);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;
alter table public.opening_hours disable trigger opening_hours_log_settings;
alter table public.services disable trigger services_log_settings;
alter table public.salon_closures disable trigger salon_closures_log_settings;

insert into auth.users (id, instance_id, aud, role) values
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.profiles (id, first_name) values
  ('00000000-0000-0000-0000-000000000b01', 'Mia'), ('00000000-0000-0000-0000-000000000b02', 'Awa');

-- Open every day, all day; a free slot from yesterday's figures.
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token,
  queue_status, waiting_count, current_wait_minutes, estimate_updated_at, next_free_slots)
values ('90000000-0000-0000-0000-000000000bb1', 'salon-hours', 'Salon Horaires', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111121', 'published', '00000000-0000-0000-0000-000000000b01', 'qrHOURS',
        'open', 1, 60, now() - interval '1 day',
        jsonb_build_array(jsonb_build_object('service_id', 'c0000000-0000-0000-0000-000000000b01', 'start_at', now() + interval '5 minutes')));
insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
select '90000000-0000-0000-0000-000000000bb1', d, '00:00', '24:00' from generate_series(1, 7) d;
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ('c0000000-0000-0000-0000-000000000b01', '90000000-0000-0000-0000-000000000bb1', 'Coupe', 30, 2000);

select is((select accepting from public.search_salons(48.85, 2.35) where slug = 'salon-hours'), true,
  'open queue within the hours: accepting');
select ok((select next_free_slot from public.search_salons(48.85, 2.35) where slug = 'salon-hours') is not null,
  'with its free slot');
select is((public.get_salon_public('salon-hours') ->> 'accepting')::boolean, true, 'the salon page says the same');

-- An exceptional closure today: closed despite the open queue (F-C2).
insert into public.salon_closures (salon_id, starts_on, ends_on)
values ('90000000-0000-0000-0000-000000000bb1', (now() at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date);
select is((select accepting from public.search_salons(48.85, 2.35) where slug = 'salon-hours'), false,
  'closed today: not accepting, whatever the queue button says');
select is((select next_free_slot from public.search_salons(48.85, 2.35) where slug = 'salon-hours'), null,
  'and no free slot to offer');
select is((select next_opening_at from public.search_salons(48.85, 2.35) where slug = 'salon-hours'),
  ((now() at time zone 'Europe/Paris')::date + 1)::timestamp at time zone 'Europe/Paris',
  'it says when it opens again (tomorrow)');
select is((public.get_salon_public('salon-hours') ->> 'accepting')::boolean, false, 'the salon page too');
delete from public.salon_closures;

-- A place left waiting yesterday, with its phone copy.
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id, status)
values ('b0000000-0000-0000-0000-000000000b01', '90000000-0000-0000-0000-000000000bb1',
  (now() at time zone 'Europe/Paris')::date - 1, 'AAAAA', 'tokHours1', 'xxxxxxH1', 'Awa', 'app', 30, 1,
  '00000000-0000-0000-0000-000000000b02', 'waiting');
insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active)
values ('b0000000-0000-0000-0000-000000000b01', '+33639980090', '\x02', true);

select is(private.close_past_days(), 1, 'one place of an earlier day is ended');
select results_eq(
  $$select status::text, cancel_reason::text from public.tickets where id = 'b0000000-0000-0000-0000-000000000b01'$$,
  $$values ('cancelled', 'end_of_day')$$,
  'cancelled with the end-of-day reason');
select is((select is_active from private.ticket_contacts where ticket_id = 'b0000000-0000-0000-0000-000000000b01'), false,
  'its phone no longer holds a place');
select results_eq(
  $$select waiting_count, current_wait_minutes, next_free_slots from public.salons where id = '90000000-0000-0000-0000-000000000bb1'$$,
  $$values (0, null::integer, null::jsonb)$$,
  'yesterday''s figures are cleared until the engine computes today''s');

select * from finish();
rollback;
