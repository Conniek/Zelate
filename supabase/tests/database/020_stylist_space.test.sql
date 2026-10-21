begin;
select plan(9);

-- Demo seed: Camille, manager and hairdresser of the Enghien salon.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a001"}';

select is((select public.stylist_context() ->> 'access'), 'active', 'an active member is active');
select is((select public.stylist_context() ->> 'member_id'),
  '30000000-0000-0000-0000-000000000001', 'with his member id');
select ok((select public.get_stylist_queue() ? 'called'), 'the queue reads');
select ok((select public.get_stylist_queue() ? 'released'), 'with the last released client (F-S8)');

-- ADR-019: a token whose session was deleted loses staff access at once.
set local request.jwt.claims =
  '{"sub": "00000000-0000-0000-0000-00000000a001", "session_id": "00000000-0000-0000-0000-0000000000ee"}';
select is((select public.stylist_context() ->> 'access'), 'none', 'a revoked session is not staff');
select throws_ok('select public.get_stylist_queue()', '42501', null,
  'a revoked session cannot read the queue');
select is((select count(*)::int from public.salon_members), 0, 'nor the team of the salon');

reset role;
update public.salon_members set status = 'deactivated'
where id = '30000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a001"}';
select is((select public.stylist_context() ->> 'access'), 'deactivated',
  'a deactivated member is told so (F-S2)');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c001"}';
select is((select public.stylist_context() ->> 'access'), 'none', 'a client is not staff');

select * from finish();
rollback;
