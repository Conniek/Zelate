begin;
select plan(9);

truncate public.salons, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ga@test.zelate'),
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gb@test.zelate'),
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@test.zelate');

select public.submit_salon_signup(
  ('00000000-0000-0000-0000-000000000b0' || n)::uuid, 'Gerant', 'Test', 'Salon ' || n,
  '+33142000000', '1 rue de la Paix', '75002', 'Paris', '75102', 2.331, 48.869,
  '1234567890123' || n, '96.02A', 'valid'::public.siret_check_result, '{}', true)
from generate_series(1, 2) n;

create temp table before_tokens as select name, qr_token from public.salons;
grant all on before_tokens to public;

set local role service_role;

select is(public.rotate_qr_token('00000000-0000-0000-0000-000000000b01', false) ->> 'qr_token',
  (select qr_token from before_tokens where name = 'Salon 1'), 'reading does not change the token');
select is((select count(*)::int from public.salon_events where type = 'qr_regenerated'), 0, 'reading logs nothing');

select isnt(public.rotate_qr_token('00000000-0000-0000-0000-000000000b01', true) ->> 'qr_token',
  (select qr_token from before_tokens where name = 'Salon 1'), 'rotating issues a new token');
select is((select count(*)::int from public.salon_events where type = 'qr_regenerated'), 1, 'qr_regenerated is logged');
select is((select qr_token from public.salons where name = 'Salon 2'),
  (select qr_token from before_tokens where name = 'Salon 2'), 'the other salon keeps its token');
select is(char_length(public.rotate_qr_token('00000000-0000-0000-0000-000000000b02', true) ->> 'qr_token'), 32, 'a token has 32 hex characters');

select throws_ok($$select public.rotate_qr_token('00000000-0000-0000-0000-000000000b03', true)$$,
  'ZA403', 'queue.forbidden', 'a non-manager is refused');
select is((select count(*)::int from public.salon_events where type = 'qr_regenerated'), 2, 'the refused call logs nothing');

reset role;
select is(has_function_privilege('authenticated', 'public.rotate_qr_token(uuid, boolean)', 'execute'), false, 'clients cannot call it directly');

select * from finish();
rollback;
