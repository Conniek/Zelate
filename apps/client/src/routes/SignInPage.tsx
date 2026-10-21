import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Banner,
  Button,
  OtpField,
  PhoneField,
  TextField,
  useCountdown,
} from '@zelate/ui';
import {
  confirmCode,
  hasProfile,
  requestCode,
  saveFirstName,
} from '../lib/auth-api';
import type { AuthErrorKey } from '../lib/auth-api';
import { safeNext } from '@zelate/auth-policy/safe-next';

type Step = 'phone' | 'code' | 'name';

const RESEND_SECONDS = 30;

export function SignInPage() {
  const { t } = useTranslation('client');
  const { t: tErrors } = useTranslation('errors');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(RESEND_SECONDS);

  const errorText = error ? tErrors(error) : undefined;

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await requestCode(phone);
    setBusy(false);
    if (!result.ok) {
      setError(result.errorKey);
      return;
    }
    setCode('');
    setStep('code');
    countdown.start();
  }

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await confirmCode(phone, value);
    if (!result.ok) {
      setBusy(false);
      setCode('');
      setError(result.errorKey);
      return;
    }
    try {
      const known = await hasProfile();
      setBusy(false);
      if (known) void navigate(next, { replace: true });
      else setStep('name');
    } catch {
      setBusy(false);
      setError('generic.unexpected');
    }
  }

  async function submitName(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const saved = await saveFirstName(firstName);
    setBusy(false);
    if (!saved) {
      setError('generic.unexpected');
      return;
    }
    void navigate(next, { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">{t('signin.title')}</h1>

      {error && step !== 'code' ? (
        <Banner role="alert" tone="danger">
          {errorText}
        </Banner>
      ) : null}

      {step === 'phone' ? (
        <form className="grid gap-4" onSubmit={(e) => void sendCode(e)}>
          <PhoneField
            helpText={t('signin.phone.hint')}
            label={t('signin.phone.label')}
            onChange={setPhone}
            prefix={t('signin.phone.prefix')}
            value={phone}
          />
          <Button
            aria-disabled={phone.length !== 9 || undefined}
            fullWidth
            loading={busy}
            size="lg"
            type="submit"
          >
            {t('signin.send_code')}
          </Button>
        </form>
      ) : null}

      {step === 'code' ? (
        <div className="grid gap-4">
          <OtpField
            digitLabel={(index) => t('signin.code.digit_aria', { index })}
            disabled={busy}
            error={errorText}
            label={t('signin.code.label')}
            onChange={setCode}
            onComplete={(value) => void submitCode(value)}
            value={code}
          />
          <Button
            aria-disabled={countdown.isRunning || busy || undefined}
            fullWidth
            onClick={() => void sendCode()}
            variant="secondary"
          >
            {countdown.isRunning
              ? t('signin.resend_countdown', { seconds: countdown.remaining })
              : t('signin.resend')}
          </Button>
        </div>
      ) : null}

      {step === 'name' ? (
        <form className="grid gap-4" onSubmit={(e) => void submitName(e)}>
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
      ) : null}
    </main>
  );
}
