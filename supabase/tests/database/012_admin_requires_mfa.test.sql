begin;
select plan(10);

truncate public.salons, public.platform_admins, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.zelate'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.zelate');
insert into public.profiles (id, first_name) values
  ('00000000-0000-0000-0000-000000000501', 'Admin'),
  ('00000000-0000-0000-0000-000000000502', 'Other');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000501');

create function pg_temp.login(p_uid text, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-000000000501', 'aal1');
select ok(not private.is_platform_admin(), 'admin without MFA (aal1) is not a platform admin');
select is((select count(*)::int from public.platform_admins), 0, 'admin without MFA reads no platform_admins row');
select is(public.admin_access(), 'mfa_required', 'admin_access asks for MFA at aal1');

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000501', 'aal2');
select ok(private.is_platform_admin(), 'admin with MFA (aal2) is a platform admin');
select is((select count(*)::int from public.platform_admins), 1, 'admin with MFA reads platform_admins');
select is(public.admin_access(), 'granted', 'admin_access grants at aal2');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000501', 'role', 'authenticated')::text, true);
set local role authenticated;
select ok(not private.is_platform_admin(), 'a token without any aal claim is refused');

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000502', 'aal2');
select ok(not private.is_platform_admin(), 'aal2 alone does not make a platform admin');
select is(public.admin_access(), 'none', 'admin_access answers none for a non-admin');

reset role;
set local role anon;
select throws_ok('select public.admin_access()', '42501', null, 'anon cannot call admin_access');

select * from finish();
rollback;
