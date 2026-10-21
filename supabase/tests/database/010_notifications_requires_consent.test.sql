begin;

set local client_min_messages = warning;
select plan(3);

select has_column('public', 'notifications', 'requires_consent', 'notifications.requires_consent exists');
select col_not_null('public', 'notifications', 'requires_consent', 'requires_consent is not null');
select col_default_is('public', 'notifications', 'requires_consent', 'false', 'requires_consent defaults to false (essential)');

select * from finish();
rollback;
