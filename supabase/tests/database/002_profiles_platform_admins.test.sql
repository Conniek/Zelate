begin;
select plan(18);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'platform_admins', 'platform_admins exists');
select col_is_pk('public', 'profiles', 'id', 'profiles.id is the primary key');
select col_is_fk('public', 'profiles', 'id', 'profiles.id references auth.users');
select col_is_unique('public', 'profiles', 'email', 'profiles.email is unique');
select col_type_is('public', 'profiles', 'email', 'extensions', 'citext', 'profiles.email is citext');
select col_default_is('public', 'profiles', 'is_guest', 'true', 'is_guest defaults to true');
select col_is_pk('public', 'platform_admins', 'user_id', 'platform_admins.user_id is the primary key');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.platform_admins'::regclass),
  'RLS is enabled on both tables'
);

insert into auth.users (id, instance_id, aud, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select lives_ok(
  $$insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-0000000000a1', 'Awa')$$,
  'a profile can be created with a first name only'
);
select throws_ok(
  $$insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-0000000000a2', '')$$,
  '23514', null, 'an empty first name is rejected'
);
select throws_ok(
  format($$insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-0000000000a2', %L)$$, repeat('x', 31)),
  '23514', null, 'a first name over 30 characters is rejected'
);
select lives_ok(
  $$insert into public.profiles (id, first_name, email) values ('00000000-0000-0000-0000-0000000000a2', 'Bo', 'Bo@Example.com')$$,
  'a second profile with an email is accepted'
);
select throws_ok(
  $$update public.profiles set email = 'bo@example.com' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23505', null, 'email uniqueness ignores case'
);

select ok(
  (select is_guest from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'is_guest is true by default'
);

delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'deleting the Auth user deletes the profile'
);

insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a2');

set local role anon;
select throws_ok('select * from public.platform_admins', '42501', null, 'anon has no right on platform_admins');
select throws_ok('select * from public.profiles', '42501', null, 'anon has no right on profiles');

select * from finish();
rollback;
