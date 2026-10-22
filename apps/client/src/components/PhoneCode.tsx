import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, OtpField, PhoneField, useCountdown } from '@zelate/ui';
import { confirmCode, hasProfile, requestCode } from '../lib/auth-api';
import type { AuthErrorKey } from '../lib/auth-api';

const RESEND_SECONDS = 30;

/**
 * U-03: phone number, then the 6-digit SMS code. Used by `/signin` and by
 * step 4 of joining a queue (F-C3). Calls `onSignedIn` with whether the
 * person already has a profile (first name known).
 */
export function PhoneCode({
  onSignedIn,
}: {
  onSignedIn: (known: boolean) => void;
}) {
  const { t } = useTranslation('client');
  const { t: tErrors } = useTranslation('errors');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(RESEND_SECONDS);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const errorText = error ? tErrors(error) : undefined;
  const codeBox = useRef<HTMLDivElement>(null);
  // The send button is gone once the code is asked: the focus goes to digit 1.
  useEffect(() => {
    if (step === 'code') codeBox.current?.querySelector('input')?.focus();
  }, [step]);
  // An error is linked to its field once it is rendered, then focused.
  useEffect(() => {
    if (phoneError || (error && step === 'phone')) {
      document.getElementById('signin-phone')?.focus();
    }
  }, [error, phoneError, step]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (phone.length !== 9) {
      setPhoneError(t('signin.phone.invalid'));
      return;
    }
    setPhoneError(null);
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
      onSignedIn(known);
    } catch {
      setBusy(false);
      setError('generic.unexpected');
    }
  }

  if (step === 'phone') {
    return (
      <form className="grid gap-4" onSubmit={(e) => void sendCode(e)}>
        <PhoneField
          error={phoneError ?? errorText}
          helpText={t('signin.phone.hint')}
          id="signin-phone"
          label={t('signin.phone.label')}
          onChange={(digits) => {
            setPhoneError(null);
            setError(null);
            setPhone(digits);
          }}
          prefix={t('signin.phone.prefix')}
          value={phone}
        />
        <Button fullWidth loading={busy} size="lg" type="submit">
          {t('signin.send_code')}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4" ref={codeBox}>
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
        onClick={() => !countdown.isRunning && void sendCode()}
        variant="secondary"
      >
        {countdown.isRunning
          ? t('signin.resend_countdown', { seconds: countdown.remaining })
          : t('signin.resend')}
      </Button>
    </div>
  );
}
