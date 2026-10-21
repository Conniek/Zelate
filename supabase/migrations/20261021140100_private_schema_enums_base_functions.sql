-- DEV-1 step 2/11: private schema, enumerations (BACKEND_SCHEMA §3) and
-- base trigger functions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.salon_status as enum
  ('draft', 'pending_review', 'approved', 'published', 'rejected', 'suspended');
create type public.queue_status as enum ('closed', 'open', 'paused');
create type public.member_role as enum ('manager', 'stylist');
create type public.member_status as enum ('invited', 'active', 'deactivated');
create type public.presence_status as enum
  ('offline', 'available', 'in_service', 'on_break', 'late', 'absent', 'off_duty');
create type public.break_type as enum ('meal', 'short', 'unexpected');
create type public.ticket_status as enum
  ('pending_confirmation', 'waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show');
create type public.ticket_kind as enum ('queue', 'appointment');
create type public.appointment_source as enum ('salon_entry', 'client_check_in');
create type public.ticket_channel as enum ('app', 'qr', 'front_desk');
create type public.reassignment_choice as enum ('accepted', 'refused', 'expired');
create type public.eta_response as enum ('on_time', 'late');
create type public.end_of_day_choice as enum ('stay', 'cancel');
create type public.closing_decision as enum ('serve', 'cancel');
create type public.cancel_reason as enum
  ('client_cancelled', 'removed_by_salon', 'stylist_unavailable', 'end_of_day',
   'appointment_rejected', 'merged');
create type public.removal_reason as enum
  ('emergency', 'client_request', 'duplicate', 'inappropriate_behaviour', 'other');
create type public.actor_type as enum ('client', 'stylist', 'manager', 'system', 'admin');
create type public.ticket_event_type as enum
  ('created', 'assigned', 'reassigned', 'estimate_changed', 'eta_responded', 'postponed',
   'stylist_change_requested', 'stylist_change_resolved', 'arrival_confirmed', 'called',
   'service_started', 'duration_adjusted', 'completed', 'cancelled', 'no_show',
   'end_of_day_warned', 'end_of_day_responded', 'appointment_checked_in',
   'appointment_confirmed', 'appointment_rejected', 'appointment_merged',
   'appointment_updated', 'appointment_delay_warned', 'reassignment_requested',
   'reassignment_resolved');
create type public.salon_event_type as enum
  ('submitted', 'approved', 'rejected', 'published', 'suspended', 'queue_opened',
   'queue_paused', 'queue_closed', 'closing_resolved', 'presence_changed',
   'hairdressing_toggled', 'member_invited', 'member_activated', 'member_deactivated',
   'member_sessions_revoked', 'qr_regenerated', 'settings_updated',
   'admin_viewed_client_data');
create type public.notification_channel as enum ('push', 'sms', 'email');
create type public.notification_template as enum
  ('ticket_created', 'turn_approaching', 'get_ready', 'your_turn', 'arrival_reminder',
   'released_no_show', 'estimate_changed', 'postponed', 'stylist_change_required',
   'end_of_day_risk', 'cancelled_by_salon', 'appointment_confirmed',
   'appointment_rejected', 'appointment_delay', 'reassignment_request',
   'no_show_warning', 'appointment_checked_in', 'member_invitation', 'salon_decision',
   'daily_summary');
create type public.estimate_change_reason as enum
  ('service_longer', 'service_shorter', 'client_ahead_left', 'client_ahead_late',
   'client_postponed', 'client_late', 'stylist_break', 'stylist_break_ended',
   'stylist_late', 'stylist_unavailable', 'stylist_available', 'hairdressing_toggled',
   'reassigned', 'stylist_choice', 'appointment_ahead', 'appointment_changed',
   'your_appointment_changed');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');
create type public.verification_decision as enum ('pending', 'approved', 'rejected');
create type public.siret_check_result as enum
  ('valid', 'naf_mismatch', 'inactive', 'not_found', 'error');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.prevent_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- Trigger functions are never meant to be called through the API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_update_delete() from public, anon, authenticated;
