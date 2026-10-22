import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '@zelate/auth-policy/safe-next';
import { Banner, Button, TextField } from '@zelate/ui';
import { PhoneCode } from '../components/PhoneCode';
import { saveFirstName } from '../lib/auth-api';

/** `/signin` (U-03): SMS code, then the first name on a first visit. */
export function SignInPage() {
  const { t } = useTranslation('client');
  const { t: tErrors } = useTranslation('errors');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [askName, setAskName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitName(event: FormEvent) {
    event.preventDefault();
    if (busy || firstName.trim() === '') return;
    setBusy(true);
    setError(false);
    const saved = await saveFirstName(firstName);
    setBusy(false);
    if (!saved) {
      setError(true);
      return;
    }
    void navigate(next, { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">{t('signin.title')}</h1>
      {askName ? (
        <form className="grid gap-4" onSubmit={(e) => void submitName(e)}>
          {error ? (
            <Banner role="alert" tone="danger">
              {tErrors('generic.unexpected')}
            </Banner>
          ) : null}
          <TextField
            autoComplete="given-name"
            helpText={t('signin.first_name.hint')}
            label={t('signin.first_name.label')}
            maxLength={30}
            onChange={(e) => setFirstName(e.target.value)}
            value={firstName}
          />
          <Button
            aria-disabled={firstName.trim().length === 0 || undefined}
            fullWidth
            loading={busy}
            size="lg"
            type="submit"
          >
            {t('signin.create_account')}
          </Button>
        </form>
      ) : (
        <PhoneCode
          onSignedIn={(known) =>
            known ? void navigate(next, { replace: true }) : setAskName(true)
          }
        />
      )}
    </main>
  );
}
