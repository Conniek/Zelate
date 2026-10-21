-- DEV-5: « Je coiffe » is a queue command (set_hairdressing, ADR-003), written
-- only by the queue service, which logs `hairdressing_toggled` itself. The
-- settings trigger counted it a second time as `settings_updated` by `system`.
drop trigger salon_members_log_settings on public.salon_members;
create trigger salon_members_log_settings
  after insert or update or delete on public.salon_members
  for each row execute function public.log_settings_update('first_name,last_name,photo_path');
