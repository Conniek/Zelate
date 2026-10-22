begin;

-- DEV-8 part 3 (U-10, U-12): « Attendre » offered or not, last change and reason.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(4);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;

insert into auth.users (id, instance_id, aud, role)
select ('00000000-0000-0000-0000-0000000009' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
from unnest(array['01','02','03']) n;
insert into public.profiles (id, first_name)
select ('00000000-0000-0000-0000-0000000009' || n)::uuid, 'U' || n from unnest(array['01','02','03']) n;

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token)
values ('90000000-0000-0000-0000-0000000009a1', 'salon-banner', 'Salon Bandeau', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111119', 'published', '00000000-0000-0000-0000-000000000901', 'qrBANNER');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email, is_hairdressing) values
  ('a0000000-0000-0000-0000-000000000901', '90000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-000000000901', 'manager', 'active', 'Mia', 'A', 'mia@banner.test', false),
  ('a0000000-0000-0000-0000-000000000902', '90000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-000000000902', 'stylist', 'active', 'Sam', 'A', 'sam@banner.test', true);
insert into public.stylist_presence (salon_id, member_id, service_date, status, status_since)
values ('90000000-0000-0000-0000-0000000009a1', 'a0000000-0000-0000-0000-000000000902', (now() at time zone 'Europe/Paris')::date, 'late', now());

insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id, requested_member_id, status, stylist_change_pending_since)
values ('b0000000-0000-0000-0000-000000000901', '90000000-0000-0000-0000-0000000009a1', (now() at time zone 'Europe/Paris')::date,
   'AAAAA', 'tokBan1', 'xxxxxxB1', 'Awa', 'app', 30, 1, '00000000-0000-0000-0000-000000000903',
   'a0000000-0000-0000-0000-000000000902', 'waiting', now());
insert into public.ticket_events (ticket_id, salon_id, type, actor_type, reason_code) values
  ('b0000000-0000-0000-0000-000000000901', '90000000-0000-0000-0000-0000000009a1', 'estimate_changed', 'system', 'stylist_late');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-000000000903');
select is((public.my_ticket() -> 'ticket' ->> 'wait_offered')::boolean, true, 'a late stylist can still be waited for');
select is(public.my_ticket() -> 'ticket' -> 'last_change' ->> 'reason', 'stylist_late', 'the last change comes with its reason (K26)');
reset role;

update public.stylist_presence set status = 'absent' where member_id = 'a0000000-0000-0000-0000-000000000902';
select pg_temp.login('00000000-0000-0000-0000-000000000903');
select is((public.my_ticket() -> 'ticket' ->> 'wait_offered')::boolean, false, 'no « Attendre » for a stylist absent all day (E7)');
reset role;

update public.stylist_presence set status = 'available' where member_id = 'a0000000-0000-0000-0000-000000000902';
update public.salon_members set is_hairdressing = false where id = 'a0000000-0000-0000-0000-000000000902';
select pg_temp.login('00000000-0000-0000-0000-000000000903');
select is((public.my_ticket() -> 'ticket' ->> 'wait_offered')::boolean, false, 'no « Attendre » for someone who no longer cuts hair (E8)');
reset role;

select * from finish();
rollback;
