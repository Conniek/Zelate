begin;
select plan(19);

truncate public.salons, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ga@test.zelate'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gb@test.zelate'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lea@test.zelate');

create temp table s (n int, id uuid);
grant all on s to public;
insert into s
select n, public.submit_salon_signup(
  ('00000000-0000-0000-0000-000000000a0' || n)::uuid, 'Gerant', 'Test', 'Salon ' || n,
  '+33142000000', '1 rue de la Paix', '75002', 'Paris', '75102', 2.331, 48.869,
  '1234567890123' || n, '96.02A', 'valid'::public.siret_check_result, '{}', true)
from generate_series(1, 2) n;

create function pg_temp.invite(p_manager text, p_email text, p_specs text[], p_hash text) returns jsonb language sql as $$
  select public.invite_member(p_manager::uuid, 'Léa', 'Durand', p_email, p_specs,
    decode(p_hash, 'hex'), now() + interval '72 hours')
$$;

set local role service_role;

select lives_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 'lea@test.zelate', array['women_cut'], '01')$$,
  'the manager invites a stylist');
select is((select status::text from public.salon_members where email = 'lea@test.zelate'), 'invited', 'the member is invited');
select is((select count(*)::int from public.salon_events where type = 'member_invited'), 1, 'member_invited is logged');
reset role;
select is((select count(*)::int from private.member_invitations), 1, 'an invitation with a hash is stored');
set local role service_role;

select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 'x@test.zelate', array[]::text[], '02')$$,
  'ZA400', 'team.specialty_required', 'a specialty is required');
select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 'pas-un-email', array['beard'], '02')$$,
  'ZA400', 'queue.invalid_payload', 'a malformed e-mail is refused');
select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 'LEA@test.zelate', array['beard'], '02')$$,
  'ZA409', 'team.email_already_used', 'a duplicate e-mail in the salon is refused, case-insensitively');
select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a02', 'lea@test.zelate', array['beard'], '02')$$,
  'ZA409', 'team.email_already_used', 'an e-mail attached to another salon is refused with the same code');
select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a03', 'z@test.zelate', array['beard'], '02')$$,
  'ZA403', 'queue.forbidden', 'a non-manager is refused');

-- Limit of 20 stylists
select lives_ok($$
  select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 's' || n || '@test.zelate', array['beard'], lpad(to_hex(100 + n), 4, '0'))
  from generate_series(1, 19) n$$, 'the salon reaches 20 stylists');
select throws_ok(
  $$select pg_temp.invite('00000000-0000-0000-0000-000000000a01', 'one-too-many@test.zelate', array['beard'], '0300')$$,
  'ZA409', 'team.limit_reached', 'the 21st stylist is refused');

-- Activation
select is(public.peek_invitation(decode('01', 'hex')) ->> 'first_name', 'Léa', 'a valid link is readable');
select throws_ok($$select public.peek_invitation(decode('ff', 'hex'))$$, 'ZA410', 'invite.link_invalid', 'an unknown link is refused');
select is(public.find_auth_user_id('LEA@test.zelate'), '00000000-0000-0000-0000-000000000a03'::uuid, 'an existing account is found');
select lives_ok($$select public.activate_invitation(decode('01', 'hex'), '00000000-0000-0000-0000-000000000a03')$$, 'the invitation is activated');
select is(
  (select status::text || ':' || profile_id::text from public.salon_members where email = 'lea@test.zelate'),
  'active:00000000-0000-0000-0000-000000000a03', 'the member is active and linked');
select is((select count(*)::int from public.salon_events where type = 'member_activated'), 1, 'member_activated is logged');
select throws_ok($$select public.activate_invitation(decode('01', 'hex'), '00000000-0000-0000-0000-000000000a03')$$, 'ZA410', 'invite.link_invalid', 'a used link is refused');

reset role;
update private.member_invitations set expires_at = now() - interval '1 minute' where token_hash = decode('0065', 'hex');
set local role service_role;
select throws_ok($$select public.peek_invitation(decode('0065', 'hex'))$$, 'ZA410', 'invite.link_invalid', 'an expired link is refused');

select * from finish();
rollback;
