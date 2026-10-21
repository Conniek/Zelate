-- Demo data (BACKEND_SCHEMA §11). Fictional salons and people; phone numbers
-- are in the reserved fictional range 06 39 98 xx xx. Never put real data here.
-- Local use only: `supabase db reset` replays it.

-- Auth users: 2 managers, 1 platform admin, 3 test clients.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gerant.enghien@demo.zelate.test', now()),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gerant.montmorency@demo.zelate.test', now()),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@demo.zelate.test', now()),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, null),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, null),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, null);

insert into public.profiles (id, first_name, last_name, email, is_guest) values
  ('00000000-0000-0000-0000-00000000a001', 'Camille', 'Durand', 'gerant.enghien@demo.zelate.test', false),
  ('00000000-0000-0000-0000-00000000a002', 'Karim', 'Benali', 'gerant.montmorency@demo.zelate.test', false),
  ('00000000-0000-0000-0000-00000000a003', 'Admin', 'Zelaté', 'admin@demo.zelate.test', false),
  ('00000000-0000-0000-0000-00000000c001', 'Léa', null, null, true),
  ('00000000-0000-0000-0000-00000000c002', 'Hugo', null, null, true),
  ('00000000-0000-0000-0000-00000000c003', 'Sofia', null, null, true);

insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000a003');

-- Salons (published, queue open).
insert into public.salons (
  id, slug, name, phone, address_line, postal_code, city, location, siret,
  status, queue_status, welcome_message, published_at, setup_test_passed_at, created_by
) values
  ('20000000-0000-0000-0000-000000000001', 'salon-demo-enghien', 'Salon Démo Enghien', '+33639980001',
   '12 rue du Général de Gaulle', '95880', 'Enghien-les-Bains', 'SRID=4326;POINT(2.3074 48.9704)',
   '73282932000074', 'published', 'open', 'Bienvenue ! Installez-vous, nous vous appelons.',
   now(), now(), '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-000000000002', 'barber-demo-montmorency', 'Barber Démo Montmorency', '+33639980002',
   '5 rue de Paris', '95160', 'Montmorency', 'SRID=4326;POINT(2.3434 48.9884)',
   '80295478500028', 'published', 'open', null,
   now(), now(), '00000000-0000-0000-0000-00000000a002');

insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
select s.id, d, h.o, h.c
from public.salons s
cross join generate_series(2, 6) d
cross join (values ('09:00'::time, '12:30'::time), ('14:00'::time, '19:00'::time)) as h(o, c);

-- Members: manager (also hairdresser) + 2 stylists per salon.
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email, is_hairdressing) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a001', 'manager', 'active', 'Camille', 'Durand', 'gerant.enghien@demo.zelate.test', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'stylist', 'invited', 'Inès', 'Martin', 'ines@demo.zelate.test', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', null, 'stylist', 'invited', 'Yanis', 'Petit', 'yanis@demo.zelate.test', true),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a002', 'manager', 'active', 'Karim', 'Benali', 'gerant.montmorency@demo.zelate.test', true),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002', null, 'stylist', 'invited', 'Nadia', 'Roux', 'nadia@demo.zelate.test', true),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002', null, 'stylist', 'invited', 'Tom', 'Girard', 'tom@demo.zelate.test', true);

insert into public.member_specialties (member_id, specialty_code) values
  ('30000000-0000-0000-0000-000000000001', 'women_cut'), ('30000000-0000-0000-0000-000000000001', 'color'),
  ('30000000-0000-0000-0000-000000000002', 'women_cut'), ('30000000-0000-0000-0000-000000000002', 'styling'),
  ('30000000-0000-0000-0000-000000000003', 'men_cut'), ('30000000-0000-0000-0000-000000000003', 'beard'),
  ('30000000-0000-0000-0000-000000000011', 'men_cut'), ('30000000-0000-0000-0000-000000000011', 'beard'),
  ('30000000-0000-0000-0000-000000000012', 'men_cut'), ('30000000-0000-0000-0000-000000000012', 'kids_cut'),
  ('30000000-0000-0000-0000-000000000013', 'beard'), ('30000000-0000-0000-0000-000000000013', 'curly_hair');

-- 6 services per salon.
insert into public.services (id, salon_id, name, duration_minutes, price_cents, required_specialty_code, sort_order) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Coupe femme', 45, 3800, 'women_cut', 1),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Coupe homme', 25, 2200, 'men_cut', 2),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Coupe enfant', 20, 1600, 'kids_cut', 3),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Barbe', 15, 1200, 'beard', 4),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Couleur', 90, 6500, 'color', 5),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Brushing', 30, 2500, 'styling', 6),
  ('40000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002', 'Coupe homme', 25, 2000, 'men_cut', 1),
  ('40000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002', 'Coupe + barbe', 40, 3000, 'beard', 2),
  ('40000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002', 'Barbe', 15, 1200, 'beard', 3),
  ('40000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000002', 'Coupe enfant', 20, 1500, 'kids_cut', 4),
  ('40000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000002', 'Dégradé', 35, 2500, 'men_cut', 5),
  ('40000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000002', 'Cheveux bouclés', 40, 2800, 'curly_hair', 6);

-- Demo stylists have no auth account: mark them as active would violate the
-- "active has profile" rule, so they stay invited; presence is still seeded.
insert into public.stylist_presence (salon_id, member_id, service_date, status, status_since)
select m.salon_id, m.id, (now() at time zone 'Europe/Paris')::date, p.status::public.presence_status, now() - interval '1 hour'
from (values
  ('30000000-0000-0000-0000-000000000001'::uuid, 'in_service'),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'available'),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'on_break'),
  ('30000000-0000-0000-0000-000000000011'::uuid, 'available'),
  ('30000000-0000-0000-0000-000000000012'::uuid, 'available'),
  ('30000000-0000-0000-0000-000000000013'::uuid, 'off_duty')
) p(id, status)
join public.salon_members m on m.id = p.id;

-- Today's queue for Salon Démo Enghien, one ticket per status and appointment case.
insert into public.tickets (
  id, salon_id, service_date, short_code, tracking_token, tracking_short_code, kind,
  scheduled_at, appointment_source, confirmed_at, client_id, display_name, channel,
  service_id, planned_duration_minutes, assigned_member_id, status, queue_rank,
  eta_response, declared_delay_minutes, arrived_at, called_at, release_due_at,
  started_at, completed_at, actual_duration_minutes, cancelled_at, cancel_reason, no_show_at,
  estimated_start_at
)
select
  t.id::uuid, '20000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Paris')::date,
  t.code, encode(extensions.gen_random_bytes(24), 'hex'),
  substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8),
  t.kind::public.ticket_kind, t.sched, t.src::public.appointment_source,
  case when t.src = 'salon_entry' then now() end,
  t.client::uuid, t.name, t.channel::public.ticket_channel,
  t.service::uuid, t.dur, t.stylist::uuid, t.status::public.ticket_status, t.rank,
  t.eta::public.eta_response, t.delay, t.arrived, t.called, t.rel, t.started, t.completed,
  t.actual, t.cancelled, t.reason::public.cancel_reason, t.noshow, t.est
from (values
  ('50000000-0000-0000-0000-000000000001', 'AB2CD', 'queue', null::timestamptz, null, null, 'Marc', 'front_desk', '40000000-0000-0000-0000-000000000002', 25::smallint, '30000000-0000-0000-0000-000000000003', 'completed', 1, null, null::smallint, now() - interval '2 hours', null::timestamptz, null::timestamptz, now() - interval '110 minutes', now() - interval '85 minutes', 25::smallint, null::timestamptz, null, null::timestamptz, null::timestamptz),
  ('50000000-0000-0000-0000-000000000002', 'EF3GH', 'queue', null, null, '00000000-0000-0000-0000-00000000c001', 'Léa', 'app', '40000000-0000-0000-0000-000000000001', 45, '30000000-0000-0000-0000-000000000001', 'in_service', 2, null, null, now() - interval '30 minutes', null, null, now() - interval '20 minutes', null, null, null, null, null, null),
  ('50000000-0000-0000-0000-000000000003', 'JK4MN', 'queue', null, null, '00000000-0000-0000-0000-00000000c002', 'Hugo', 'qr', '40000000-0000-0000-0000-000000000002', 25, '30000000-0000-0000-0000-000000000002', 'called', 3, null, null, null, now() - interval '2 minutes', now() + interval '8 minutes', null, null, null, null, null, null, null),
  ('50000000-0000-0000-0000-000000000004', 'PQ5RS', 'queue', null, null, '00000000-0000-0000-0000-00000000c003', 'Sofia', 'app', '40000000-0000-0000-0000-000000000006', 30, null, 'waiting', 4, null, null, null, null, null, null, null, null, null, null, null, now() + interval '25 minutes'),
  ('50000000-0000-0000-0000-000000000005', 'TU6VW', 'queue', null, null, null, 'Paul', 'front_desk', '40000000-0000-0000-0000-000000000004', 15, null, 'waiting', 5, null, null, null, null, null, null, null, null, null, null, null, now() + interval '40 minutes'),
  ('50000000-0000-0000-0000-000000000006', 'XY7ZA', 'queue', null, null, null, 'Nora', 'front_desk', '40000000-0000-0000-0000-000000000003', 20, '30000000-0000-0000-0000-000000000002', 'no_show', 6, null, null, now() - interval '70 minutes', null, null, null, null, null, null, null, now() - interval '55 minutes', null),
  ('50000000-0000-0000-0000-000000000007', 'BC8DE', 'queue', null, null, null, 'Sam', 'app', '40000000-0000-0000-0000-000000000002', 25, null, 'cancelled', 7, null, null, null, null, null, null, null, null, now() - interval '45 minutes', 'client_cancelled', null, null),
  ('50000000-0000-0000-0000-000000000008', 'FG9HJ', 'appointment', now() + interval '1 hour', 'salon_entry', null, 'Julie', 'front_desk', '40000000-0000-0000-0000-000000000005', 90, '30000000-0000-0000-0000-000000000001', 'waiting', 8, 'on_time', null, null, null, null, null, null, null, null, null, null, now() + interval '1 hour'),
  ('50000000-0000-0000-0000-000000000009', 'KM2NP', 'appointment', now() + interval '20 minutes', 'salon_entry', null, 'Omar', 'front_desk', '40000000-0000-0000-0000-000000000002', 25, '30000000-0000-0000-0000-000000000003', 'waiting', 9, 'late', 15, null, null, null, null, null, null, null, null, null, now() + interval '35 minutes'),
  ('50000000-0000-0000-0000-000000000010', 'QR3ST', 'appointment', now() + interval '2 hours', 'client_check_in', null, 'Anna', 'app', '40000000-0000-0000-0000-000000000001', 45, null, 'pending_confirmation', 10, null, null, null, null, null, null, null, null, null, null, null, null)
) as t(id, code, kind, sched, src, client, name, channel, service, dur, stylist, status, rank,
       eta, delay, arrived, called, rel, started, completed, actual, cancelled, reason, noshow, est);

-- Contacts of the three test clients (fictional numbers).
insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active, closed_at)
select t.id, p.phone, extensions.digest(p.phone, 'sha256'), true, null
from (values
  ('50000000-0000-0000-0000-000000000002'::uuid, '+33639980101'),
  ('50000000-0000-0000-0000-000000000003'::uuid, '+33639980102'),
  ('50000000-0000-0000-0000-000000000004'::uuid, '+33639980103')
) p(id, phone)
join public.tickets t on t.id = p.id;
