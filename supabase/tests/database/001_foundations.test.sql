begin;
select plan(13);

select has_extension('extensions', 'postgis', 'postgis is installed');
select has_extension('extensions', 'pgcrypto', 'pgcrypto is installed');
select has_extension('extensions', 'citext', 'citext is installed');
select has_extension('extensions', 'pg_net', 'pg_net is installed');
select ok(
  exists (select 1 from pg_extension where extname = 'pg_cron'),
  'pg_cron is installed'
);

select has_schema('private', 'private schema exists');
select ok(
  not has_any_column_privilege('anon', 'private.ticket_contacts', 'select')
  and not has_function_privilege('anon', 'public.set_updated_at()', 'execute')
  and not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'anon and authenticated hold no right on private tables or trigger functions'
);

select enum_has_labels(
  'public', 'ticket_status',
  array['pending_confirmation', 'waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show'],
  'ticket_status has the documented values in order'
);
select enum_has_labels(
  'public', 'presence_status',
  array['offline', 'available', 'in_service', 'on_break', 'late', 'absent', 'off_duty'],
  'presence_status has the documented values in order'
);
select is(
  (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype = 'e'),
  25,
  'the 25 enumerations of BACKEND_SCHEMA §3 exist'
);

-- set_updated_at and prevent_update_delete on a throw-away table.
create table public._probe (id int primary key, updated_at timestamptz not null default '2000-01-01');
create trigger probe_updated before update on public._probe
  for each row execute function public.set_updated_at();
create table public._probe_log (id int primary key);
create trigger probe_append_only before update or delete on public._probe_log
  for each row execute function public.prevent_update_delete();
insert into public._probe values (1);
insert into public._probe_log values (1);

update public._probe set id = 1 where id = 1;
select ok(
  (select updated_at > now() - interval '1 minute' from public._probe where id = 1),
  'set_updated_at refreshes updated_at'
);
select throws_ok(
  'update public._probe_log set id = 2', '42501', null,
  'prevent_update_delete rejects updates'
);
select throws_ok(
  'delete from public._probe_log', '42501', null,
  'prevent_update_delete rejects deletes'
);

select * from finish();
rollback;
