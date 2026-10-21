begin;
select plan(2);

-- Demo seed: Camille, manager of the Enghien salon. The seed itself already
-- logged settings, so the test counts what each update adds.
create temporary table counts as
select count(*)::int as n from public.salon_events
where salon_id = '20000000-0000-0000-0000-000000000001' and type = 'settings_updated';

update public.salon_members set is_hairdressing = not is_hairdressing
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.salon_events
   where salon_id = '20000000-0000-0000-0000-000000000001' and type = 'settings_updated'),
  (select n from counts),
  '« Je coiffe » is not logged as a setting (the queue logs hairdressing_toggled)');

update public.salon_members set last_name = 'Durand-Test'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.salon_events
   where salon_id = '20000000-0000-0000-0000-000000000001' and type = 'settings_updated'),
  (select n + 1 from counts),
  'a name change is still logged');

select * from finish();
rollback;
