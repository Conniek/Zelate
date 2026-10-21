begin;
select plan(17);

truncate public.salons, public.platform_admins, private.ticket_contacts cascade;
truncate private.signup_drafts;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gerant@test.zelate'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre@test.zelate');

create function pg_temp.login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Drafts (scenarios 7 and 9)
select pg_temp.login('00000000-0000-0000-0000-000000000701');
select is(public.get_signup_draft(), null::jsonb, 'no draft before the first save');
select lives_ok($$select public.save_signup_draft(2::smallint, '{"salon_name":"Chez Lea"}')$$, 'saves a draft');
select lives_ok($$select public.save_signup_draft(2::smallint, '{"phone":"+33142000000"}')$$, 'a later save merges fields');
select is(public.get_signup_draft(), '{"step":2,"data":{"salon_name":"Chez Lea","phone":"+33142000000"}}'::jsonb, 'draft returns step and merged data');
select throws_ok($$select public.save_signup_draft(2::smallint, '{"password":"secret"}')$$, '23514', null, 'a password is never stored');
select throws_ok($$select public.save_signup_draft(9::smallint, '{}')$$, '22023', 'invalid draft', 'refuses a step out of range');

reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000702');
select is(public.get_signup_draft(), null::jsonb, 'another user does not see the draft');

reset role;
update private.signup_drafts set expires_at = now() - interval '1 minute';
select pg_temp.login('00000000-0000-0000-0000-000000000701');
select is(public.get_signup_draft(), null::jsonb, 'an expired draft is not returned');
reset role;
select lives_ok($$select private.daily_maintenance()$$, 'the daily maintenance runs');
select is((select count(*)::int from private.signup_drafts), 0, 'daily maintenance deletes expired drafts');

-- Submit (scenarios 11 and 12)
create function pg_temp.submit(p_result public.siret_check_result) returns uuid language sql as $$
  select public.submit_salon_signup(
    '00000000-0000-0000-0000-000000000701', 'Lea', 'Martin', 'Chez Léa & Fils', '+33142000000',
    '1 rue de la Paix', '75002', 'Paris', '75102', 2.331, 48.869,
    '12345678901234', '9602A', p_result, '{"raw":true}', true)
$$;

create temp table submitted (salon_id uuid);
grant all on submitted to public;
set local role service_role;
insert into submitted select pg_temp.submit('valid');
select is((select status::text from public.salons where id = (select salon_id from submitted)), 'pending_review', 'the salon is pending review');
select is((select is_guest from public.profiles where id = '00000000-0000-0000-0000-000000000701'), false, 'the manager profile is not a guest');
select is(
  (select count(*)::int from public.salon_members where salon_id = (select salon_id from submitted) and role = 'manager' and status = 'active' and is_hairdressing),
  1, 'the manager member is created');
select is(
  (select decision::text || ':' || siret_check_result::text from public.salon_verifications where salon_id = (select salon_id from submitted)),
  'pending:valid', 'a pending verification keeps the SIRET result');
select is((select count(*)::int from public.salon_events where salon_id = (select salon_id from submitted) and type = 'submitted'), 1, 'the submitted event is logged');
select is(pg_temp.submit('inactive'), (select salon_id from submitted), 'a second submit returns the same salon');
select is((select count(*)::int from public.salon_verifications), 1, 'a double submit creates a single verification');

select * from finish();
rollback;
