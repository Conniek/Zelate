begin;

-- U-16 (F-C1, E22): the earliest free slot with its service name, open queue only.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(5);

alter table public.salons disable trigger salons_log_settings;
alter table public.services disable trigger services_log_settings;
alter table public.opening_hours disable trigger opening_hours_log_settings;

insert into auth.users (id, instance_id, aud, role) values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-000000000801', 'Mia');

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status,
  queue_status, created_by, qr_token)
values ('90000000-0000-0000-0000-0000000008a1', 'salon-slot', 'Salon Créneau', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111118', 'published', 'open',
        '00000000-0000-0000-0000-000000000801', 'qrSLOT');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('c0000000-0000-0000-0000-000000000801', '90000000-0000-0000-0000-0000000008a1', 'Coupe homme', 30, 2500),
  ('c0000000-0000-0000-0000-000000000802', '90000000-0000-0000-0000-0000000008a1', 'Couleur', 90, 6000);
-- Open all day, every day: the free slot is shown only within the hours.
insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
select '90000000-0000-0000-0000-0000000008a1', d, '00:00', '24:00' from generate_series(1, 7) d;
update public.salons set next_free_slots = jsonb_build_array(
    jsonb_build_object('service_id', 'c0000000-0000-0000-0000-000000000802', 'start_at', '2026-10-22T14:00:00Z'),
    jsonb_build_object('service_id', 'c0000000-0000-0000-0000-000000000801', 'start_at', '2026-10-22T13:20:00Z'))
where id = '90000000-0000-0000-0000-0000000008a1';

set local role anon;
select is((select next_free_slot ->> 'service_name' from public.search_salons(48.85, 2.35)), 'Coupe homme',
  'the earliest slot comes with the name of its service');
select is((select (next_free_slot ->> 'start_at')::timestamptz from public.search_salons(48.85, 2.35)),
  '2026-10-22T13:20:00Z'::timestamptz, 'the earliest slot is the one shown');
select ok((select latitude is not null and longitude is not null from public.search_salons(48.85, 2.35)),
  'the salon comes with its position for the map');
reset role;

update public.salons set queue_status = 'paused' where id = '90000000-0000-0000-0000-0000000008a1';
set local role anon;
select is((select next_free_slot from public.search_salons(48.85, 2.35)), null,
  'no free slot while the queue is not open (E22)');
reset role;

-- U-01 scenario 9: a closed salon gives its next opening.
update public.salons set queue_status = 'closed' where id = '90000000-0000-0000-0000-0000000008a1';
set local role anon;
select ok((select next_opening_at > now() and next_opening_at < now() + interval '25 hours'
           from public.search_salons(48.85, 2.35)), 'a closed salon gives its next opening');
reset role;

select * from finish();
rollback;
