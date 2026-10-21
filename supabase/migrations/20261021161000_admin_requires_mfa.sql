-- DEV-3 step 3: platform admin rights need a session verified with a second
-- factor (TRD §7: "MFA obligatoire"). The check lives in the database so that
-- no client or Edge Function can forget it: every policy and RPC that calls
-- private.is_platform_admin() is covered.

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Lets the Pro app route an admin to MFA enrolment or verification: at aal1 the
-- policies hide platform_admins, so the caller could not otherwise tell. It
-- only ever answers about the caller.
create function public.admin_access()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.platform_admins where user_id = auth.uid()) then 'none'
    when coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2' then 'granted'
    else 'mfa_required'
  end;
$$;

revoke all on function public.admin_access() from public, anon;
grant execute on function public.admin_access() to authenticated;
