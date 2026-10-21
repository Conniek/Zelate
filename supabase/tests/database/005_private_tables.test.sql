begin;

-- Tests start from an empty database: drop the demo seed inside the transaction.
set local client_min_messages = warning;
truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
delete from auth.users where id::text ~ '^00000000-0000-0000-0000-00000000[ac]00';
select plan(18);

select has_table('private', t, 'private.' || t || ' exists')
from unnest(array['ticket_contacts', 'member_invitations', 'processed_commands',
                  'rate_limits', 'no_show_records', 'no_show_warnings', 'signup_drafts']) as t;

select is(
  (select count(*)::int from pg_class c where c.relnamespace = 'private'::regnamespace
   and c.relkind = 'r' and c.relrowsecurity),
  7, 'RLS is enabled on every private table'
);
select ok(
  not has_table_privilege('anon', 'private.ticket_contacts', 'select')
  and not has_table_privilege('authenticated', 'private.ticket_contacts', 'select')
  and not has_table_privilege('authenticated', 'private.no_show_records', 'select'),
  'anon and authenticated hold no right on private tables'
);

insert into auth.users (id, instance_id, aud, role)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-000000000201', 'Ely');
insert into public.salons (id, slug, name, phone, address_line, postal_code, city, location, siret, created_by)
values ('40000000-0000-0000-0000-000000000001', 'salon-p', 'Salon P', '+33612345678', '1 rue A', '75001', 'Paris',
        'SRID=4326;POINT(2.35 48.85)', '12345678901234', '00000000-0000-0000-0000-000000000201');
insert into public.tickets (id, salon_id, service_date, short_code, tracking_token, tracking_short_code,
                            display_name, channel, planned_duration_minutes, queue_rank)
select ('50000000-0000-0000-0000-00000000000' || i)::uuid, '40000000-0000-0000-0000-000000000001', '2026-10-21',
       'AAAA' || (array['A','B','C'])[i], 'tok' || i, lpad(i::text, 8, 'x'), 'Awa', 'app', 30, i
from generate_series(1, 3) i;

select lives_ok(
  $$insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active)
    values ('50000000-0000-0000-0000-000000000001', '+33612345678', '\x01', true)$$,
  'a contact can be created'
);
select throws_ok(
  $$insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active)
    values ('50000000-0000-0000-0000-000000000002', '+33612345678', '\x01', true)$$,
  '23505', null, 'one active ticket per phone number'
);
select lives_ok(
  $$insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active, is_pending_confirmation)
    values ('50000000-0000-0000-0000-000000000002', '+33612345678', '\x01', true, true)$$,
  'a pending check-in does not block the number (K14)'
);
select lives_ok(
  $$insert into private.ticket_contacts (ticket_id, phone_e164, phone_hash, is_active, closed_at)
    values ('50000000-0000-0000-0000-000000000003', '+33612345678', '\x01', false, now())$$,
  'closed contacts do not count'
);
delete from public.tickets where id = '50000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from private.ticket_contacts where ticket_id = '50000000-0000-0000-0000-000000000003'),
  0, 'deleting a ticket deletes its contact'
);

select lives_ok(
  $$insert into private.processed_commands (command_id, command, response)
    values (gen_random_uuid(), 'join_queue', '{}')$$,
  'a processed command can be stored'
);
select lives_ok(
  $$insert into private.rate_limits (bucket, key_hash, window_start, count) values ('sms', '\x01', now(), 1)$$,
  'a rate-limit counter can be stored'
);
select throws_ok(
  $$insert into private.rate_limits (bucket, key_hash, window_start, count) values ('sms', '\x01', now(), -1)$$,
  '23514', null, 'a negative counter is rejected'
);

set local role authenticated;
select throws_ok('select * from private.ticket_contacts', '42501', null, 'authenticated cannot read private.ticket_contacts');

select * from finish();
rollback;
