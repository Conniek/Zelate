begin;
select plan(19);

truncate public.salons, public.platform_admins, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.zelate'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g1@test.zelate'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g2@test.zelate'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g3@test.zelate');
insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-000000000801', 'Admin');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000801');

create temp table s (n int, id uuid);
grant all on s to public;
insert into s
select n, public.submit_salon_signup(
  ('00000000-0000-0000-0000-00000000080' || (n + 1))::uuid, 'Gerant', 'Test', 'Salon ' || n,
  '+33142000000', '1 rue de la Paix', '75002', 'Paris', '75102', 2.331, 48.869,
  '1234567890123' || n, '96.02A', case when n = 1 then 'valid' else 'not_found' end::public.siret_check_result,
  '{}', true)
from generate_series(1, 3) n;

create function pg_temp.login(p_uid text, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;

-- Access (scenario 8)
select pg_temp.login('00000000-0000-0000-0000-000000000801', 'aal1');
select throws_ok('select public.admin_list_salons()', '42501', 'not allowed', 'an admin without MFA cannot list');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000802', 'aal2');
select throws_ok(format('select public.admin_get_salon(%L)', (select id from s where n = 1)), '42501', 'not allowed', 'a manager cannot read the admin view');
select throws_ok(format('select public.admin_decide_salon(%L, ''approved'')', (select id from s where n = 1)), '42501', 'not allowed', 'a manager cannot decide');

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000801', 'aal2');

-- List and detail (scenarios 1, 2, 2 bis)
select is(jsonb_array_length(public.admin_list_salons('to_review')), 3, 'three files to review, including the unknown SIRET');
select is((select count(*)::int from jsonb_array_elements(public.admin_list_salons('to_review')) e where e ->> 'siret_check_result' = 'not_found'), 2, 'the list shows the SIRET result');
select is((public.admin_get_salon((select id from s where n = 1)) ->> 'latitude')::numeric, 48.869::numeric, 'the detail returns the position');
select is(public.admin_get_salon((select id from s where n = 1)) -> 'manager' ->> 'email', 'g1@test.zelate', 'the detail returns the manager');

-- Approve (scenario 3)
select lives_ok(format('select public.admin_decide_salon(%L, ''approved'')', (select id from s where n = 1)), 'approves a file');
select is((select status::text from public.salons where id = (select id from s where n = 1)), 'approved', 'the salon becomes approved');
select is(
  (select decision::text || ':' || (decided_by = '00000000-0000-0000-0000-000000000801')::text
   from public.salon_verifications where salon_id = (select id from s where n = 1)),
  'approved:true', 'the decision records the admin');
select is(
  (select count(*)::int from public.salon_events where salon_id = (select id from s where n = 1) and type = 'approved' and actor_type = 'admin'),
  1, 'an approved event is logged');
select is(jsonb_array_length(public.admin_list_salons('to_review')), 2, 'a decided file leaves the to-review list');
select is(jsonb_array_length(public.admin_list_salons('all')), 3, 'the full list keeps it');

-- Reject (scenarios 5 and 6)
select throws_ok(format('select public.admin_decide_salon(%L, ''rejected'', ''  '')', (select id from s where n = 2)), 'ZA400', 'validation.reject_reason_required', 'a refusal needs a reason');
select lives_ok(format('select public.admin_decide_salon(%L, ''rejected'', ''SIRET inconnu'')', (select id from s where n = 2)), 'rejects with a reason');
select is((select status::text || ':' || decision_reason from public.salons s2 join public.salon_verifications v on v.salon_id = s2.id where s2.id = (select id from s where n = 2)), 'rejected:SIRET inconnu', 'status and reason are stored');

-- Already decided (scenario 7 bis)
select throws_ok(format('select public.admin_decide_salon(%L, ''rejected'', ''Trop tard'')', (select id from s where n = 1)), 'ZA409', 'admin.salon_already_decided', 'a decided file cannot be decided again');
select throws_ok(format('select public.admin_decide_salon(%L, ''approved'')', gen_random_uuid()), 'ZA404', 'admin.salon_not_found', 'an unknown file is refused');
select throws_ok(format('select public.admin_decide_salon(%L, ''pending'')', (select id from s where n = 3)), '22023', 'invalid decision', 'pending is not a decision');

select * from finish();
rollback;
