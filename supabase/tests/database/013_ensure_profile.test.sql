begin;
select plan(8);

truncate public.salons, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '33612345678'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '33612345679');

select throws_ok($$select public.ensure_profile('Marie')$$, '28000', 'not authenticated', 'refuses an unauthenticated call');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-000000000601');
select is((public.ensure_profile('  Marie  ')).first_name, 'Marie', 'creates the profile with a trimmed first name');
select is((select is_guest from public.profiles where id = '00000000-0000-0000-0000-000000000601'), true, 'new profile is a guest');
select is((public.ensure_profile('Other')).first_name, 'Marie', 'is idempotent: an existing profile is never overwritten');
select is((public.ensure_profile('')).first_name, 'Marie', 'an existing profile is returned even without a name');

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000602');
select throws_ok($$select public.ensure_profile('   ')$$, '22023', 'invalid first name', 'refuses an empty first name');
select throws_ok($$select public.ensure_profile(repeat('a', 31))$$, '22023', 'invalid first name', 'refuses a first name over 30 characters');

reset role;
set local role anon;
select throws_ok($$select public.ensure_profile('Marie')$$, '42501', null, 'anon cannot execute it');

select * from finish();
rollback;
