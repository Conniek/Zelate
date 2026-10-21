import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '@zelate/auth-policy/safe-next';
import { Banner, Button, TextField } from '@zelate/ui';
import { supabase } from '../lib/supabase';

export function SignInPage() {
  const { t } = useTranslation('pro-manager');
  const { t: tErrors } = useTranslation('errors');
  const { t: tStylist } = useTranslation('pro-stylist');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  // F-S2: why the stylist space sent the person back here.
  const reason = params.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (failure) {
      setError(tErrors('auth.invalid_credentials'));
      return;
    }
    void navigate(next, { replace: true });
  }

  async function sendLink() {
    if (busy || email.trim() === '') return;
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
        shouldCreateUser: false,
      },
    });
    setBusy(false);
    // The same message whether or not the account exists (no enumeration).
    if (failure && failure.status !== 400) {
      setError(tErrors('generic.unexpected'));
      return;
    }
    setLinkSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">{t('signin.title')}</h1>
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      {reason === 'sessions_revoked' ? (
        <Banner role="alert" tone="warning">
          {tStylist('signin.sessions_revoked')}
        </Banner>
      ) : null}
      {reason === 'access_revoked' ? (
        <Banner role="alert" tone="danger">
          {tStylist('signin.access_revoked')}
        </Banner>
      ) : null}
      {linkSent ? <Banner>{t('signin.link_sent')}</Banner> : null}
      <form className="grid gap-4" onSubmit={(e) => void signIn(e)}>
        <TextField
          autoComplete="email"
          inputMode="email"
          label={t('signin.email')}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          value={email}
        />
        <TextField
          autoComplete="current-password"
          label={t('signin.password')}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          value={password}
        />
        <Button
          aria-disabled={email.trim() === '' || password === '' || undefined}
          fullWidth
          loading={busy}
          size="lg"
          type="submit"
        >
          {t('signin.submit')}
        </Button>
        <Button
          aria-disabled={email.trim() === '' || busy || undefined}
          fullWidth
          onClick={() => void sendLink()}
          variant="secondary"
        >
          {t('signin.magic_link')}
        </Button>
      </form>
    </main>
  );
}
