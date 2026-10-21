import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { adminGate } from '@zelate/auth-policy/admin-gate';
import type { AdminAccess, AdminGate } from '@zelate/auth-policy/admin-gate';
import { supabase } from '../lib/supabase';
import { MfaEnroll, MfaForbidden, MfaVerify } from './MfaScreens';

async function loadGate(): Promise<AdminGate> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return adminGate({
      access: 'none',
      hasVerifiedFactor: false,
      signedIn: false,
    });
  }
  const { data: access, error } = await supabase.rpc('admin_access');
  if (error) throw error;
  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  return adminGate({
    access: access as AdminAccess,
    hasVerifiedFactor: factors.totp.length > 0,
    signedIn: true,
  });
}

/** `/admin` guard (APP_FLOW §2): sign-in, then MFA, then the page. The database enforces the same rule. */
export function AdminGuard() {
  const location = useLocation();
  const [gate, setGate] = useState<AdminGate | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loadGate()
      .then((value) => {
        if (active) setGate(value);
      })
      .catch(() => {
        if (active) setGate({ action: 'forbidden' });
      });
    return () => {
      active = false;
    };
  }, [version]);

  if (!gate) return null;
  const refresh = () => {
    setGate(null);
    setVersion((current) => current + 1);
  };

  switch (gate.action) {
    case 'redirect_signin':
      return (
        <Navigate
          replace
          to={`/signin?next=${encodeURIComponent(location.pathname)}`}
        />
      );
    case 'forbidden':
      return <MfaForbidden />;
    case 'enroll_mfa':
      return <MfaEnroll onDone={refresh} />;
    case 'verify_mfa':
      return <MfaVerify onDone={refresh} />;
    case 'allow':
      return <Outlet />;
  }
}
