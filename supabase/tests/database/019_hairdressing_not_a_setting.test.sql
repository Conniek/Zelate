begin;
select plan(2);

-- Demo seed: Camille, manager of the Enghien salon.
update public.salon_members set is_hairdressing = not is_hairdressing
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.salon_events
   where salon_id = '20000000-0000-0000-0000-000000000001' and type = 'settings_updated'),
  0, '« Je coiffe » is not logged as a setting (the queue logs hairdressing_toggled)');

update public.salon_members set last_name = 'Durand-Test'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.salon_events
   where salon_id = '20000000-0000-0000-0000-000000000001' and type = 'settings_updated'),
  1, 'a name change is still logged');

select * from finish();
rollback;
