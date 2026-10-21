begin;
select plan(7);

truncate public.salons, private.ticket_contacts cascade;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.zelate'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@test.zelate');
insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-000000000902', 'Autre');

select public.submit_salon_signup(
  '00000000-0000-0000-0000-000000000901'::uuid, 'Gerant', 'Test', 'Salon',
  '+33142000000', '1 rue de la Paix', '75002', 'Paris', '75102', 2.331, 48.869,
  '12345678901234', '96.02A', 'valid'::public.siret_check_result, '{}', true);

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-000000000901');
select lives_ok(
  $$select public.replace_opening_hours('[{"weekday":1,"opens_at":"09:00","closes_at":"12:00"},{"weekday":1,"opens_at":"14:00","closes_at":"19:00"}]'::jsonb)$$,
  'manager saves two ranges on one day');
select is((select count(*)::int from public.opening_hours), 2, 'two rows stored');

select lives_ok(
  $$select public.replace_opening_hours('[{"weekday":2,"opens_at":"10:00","closes_at":"18:00"}]'::jsonb)$$,
  'saving again replaces the week');
select is((select count(*)::int from public.opening_hours where weekday = 1), 0, 'old hours are gone');

select throws_ok(
  $$select public.replace_opening_hours('[{"weekday":3,"opens_at":"09:00","closes_at":"12:00"},{"weekday":3,"opens_at":"11:00","closes_at":"15:00"}]'::jsonb)$$,
  'ZA400', 'validation.hours_overlap', 'overlap refused');
select throws_ok(
  $$select public.replace_opening_hours('[{"weekday":3,"opens_at":"12:00","closes_at":"09:00"}]'::jsonb)$$,
  'ZA400', 'validation.hours_order', 'inverted range refused');

select pg_temp.login('00000000-0000-0000-0000-000000000902');
select throws_ok(
  $$select public.replace_opening_hours('[]'::jsonb)$$,
  'ZA403', 'auth.forbidden', 'a non-manager is refused');

select * from finish();
rollback;
