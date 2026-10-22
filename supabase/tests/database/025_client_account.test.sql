begin;

-- DEV-8 part 4 (U-13, K17, K29): export and deletion of a client account.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
select plan(19);

alter table public.salons disable trigger salons_log_settings;
alter table public.salon_members disable trigger salon_members_log_settings;

-- Mia manages the salon; Awa and Bob are clients.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '33639980090'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '33639980091');
insert into public.profiles (id, first_name, tracking_consent_at) values
  ('00000000-0000-0000-0000-000000000a01', 'Mia', null),
  ('00000000-0000-0000-0000-000000000a02', 'Awa', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000a03', 'Bob', null);

insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, status, created_by, qr_token)
values ('90000000-0000-0000-0000-000000000aa1', 'salon-account', 'Salon Compte', '+33611111111', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '11111111111120', 'published', '00000000-0000-0000-0000-000000000a01', 'qrACCOUNT');
insert into public.salon_members (id, salon_id, profile_id, role, status, first_name, last_name, email, is_hairdressing) values
  ('a0000000-0000-0000-0000-000000000a01', '90000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000a01', 'manager', 'active', 'Mia', 'A', 'mia@account.test', true);

-- Awa: one past ticket removed by the salon (with a note), one waiting today.
-- Bob: one past ticket.
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
  display_name, channel, planned_duration_minutes, queue_rank, client_id, status,
  cancelled_at, cancel_reason, removal_reason, removal_note, notifications_consent_at, created_at)
values
  ('b0000000-0000-0000-0000-000000000a01', '90000000-0000-0000-0000-000000000aa1', current_date - 3, 'AAAAA', 'tokAcc1', 'xxxxxxA1',
   'Awa', 'app', 30, 1, '00000000-0000-0000-0000-000000000a02', 'cancelled', now() - interval '3 days', 'removed_by_salon', 'other', 'Note du salon',
   now() - interval '3 days', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000a02', '90000000-0000-0000-0000-000000000aa1', current_date, 'BBBBB', 'tokAcc2', 'xxxxxxA2',
   'Awa', 'app', 30, 2, '00000000-0000-0000-0000-000000000a02', 'waiting', null, null, null, null, null, now()),
  ('b0000000-0000-0000-0000-000000000a03', '90000000-0000-0000-0000-000000000aa1', current_date - 3, 'CCCCC', 'tokAcc3', 'xxxxxxA3',
   'Bob', 'app', 30, 2, '00000000-0000-0000-0000-000000000a03', 'cancelled', now() - interval '3 days', 'client_cancelled', null, null,
   null, now() - interval '3 days');
insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active, closed_at) values
  ('b0000000-0000-0000-0000-000000000a01', '+33639980090', '\x01', false, now() - interval '3 days');
insert into public.ticket_events (ticket_id, salon_id, type, actor_type, reason_code) values
  ('b0000000-0000-0000-0000-000000000a01', '90000000-0000-0000-0000-000000000aa1', 'cancelled', 'manager', 'other'),
  ('b0000000-0000-0000-0000-000000000a01', '90000000-0000-0000-0000-000000000aa1', 'duration_adjusted', 'stylist', null);

-- Export.
select is(jsonb_array_length(public.account_export('00000000-0000-0000-0000-000000000a02') -> 'tickets'), 2, 'the export holds my two tickets');
select is(public.account_export('00000000-0000-0000-0000-000000000a02') -> 'profile' ->> 'phone', '+33639980090', 'with my phone number (right of access)');
select ok(public.account_export('00000000-0000-0000-0000-000000000a02') -> 'profile' ->> 'tracking_consent_at' is not null, 'with my consents and their date');
select ok(public.account_export('00000000-0000-0000-0000-000000000a02')::text !~ '(tokAcc|xxxxxxA|Note du salon|Bob)',
  'no tracking token, no staff note, nobody else');
select is(jsonb_path_query_array(public.account_export('00000000-0000-0000-0000-000000000a02') #> '{tickets,0,events}', '$[*].type'),
  '["cancelled"]'::jsonb, 'only the events visible to the client (no duration_adjusted)');

-- Rights: only the Edge Functions (service role) call these.
select ok(not has_function_privilege('authenticated', 'public.account_export(uuid)', 'execute'), 'a client cannot export someone else');
select ok(not has_function_privilege('authenticated', 'public.account_delete(uuid, boolean)', 'execute'), 'a client cannot delete someone else');
select ok(not has_function_privilege('anon', 'public.account_delete(uuid, boolean)', 'execute'), 'anon cannot delete');

-- Deletion.
select is(public.account_delete('00000000-0000-0000-0000-000000000a01'), 'staff', 'a Zelaté Pro account is not deleted from the client app');
select is(public.account_delete('00000000-0000-0000-0000-000000000a01', true), 'staff', 'the check refuses a Pro account before any cancel');
select is(public.account_delete('00000000-0000-0000-0000-000000000a02'), 'active_ticket', 'the place in progress is cancelled first');
update public.tickets set status = 'cancelled', cancelled_at = now(), cancel_reason = 'client_cancelled'
where id = 'b0000000-0000-0000-0000-000000000a02';
select is(public.account_delete('00000000-0000-0000-0000-000000000a02', true), 'ready', 'the check deletes nothing');
select is(public.account_delete('00000000-0000-0000-0000-000000000a02'), 'deleted', 'then the account is deleted');

select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000a02'), 0, 'the Auth account is gone');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000a02'), 0, 'the profile is gone');
select results_eq(
  $$select display_name, client_id, removal_note from public.tickets
    where id in ('b0000000-0000-0000-0000-000000000a01', 'b0000000-0000-0000-0000-000000000a02') order by id$$,
  $$values ('Client'::text, null::uuid, null::text), ('Client', null, null)$$,
  'my past tickets name nobody (K29)');
select ok((select completed_at is null and cancelled_at is not null from public.tickets where id = 'b0000000-0000-0000-0000-000000000a01'),
  'their times stay for the statistics');
select is((select count(*)::int from private.ticket_contacts where ticket_id = 'b0000000-0000-0000-0000-000000000a01'), 0, 'their phone copies are gone');
select is((select display_name from public.tickets where id = 'b0000000-0000-0000-0000-000000000a03'), 'Bob', 'another client is untouched');

select * from finish();
rollback;
