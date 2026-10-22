import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { Banner, Button, Skeleton, TextField } from '@zelate/ui';
import { PhoneCode } from '../components/PhoneCode';
import { hasProfile } from '../lib/auth-api';
import { isActive } from '../lib/client-api';
import {
  useClientCommand,
  useMyTicket,
  usePageTitle,
  useSalon,
  useSession,
} from '../lib/live';
import { todaySlots } from '../lib/places';

type Step = 'time' | 'stylist' | 'identify' | 'summary';
const STEPS: Step[] = ['time', 'stylist', 'identify', 'summary'];
const DONT_KNOW = '';

/**
 * `/salons/:slug/check-in` (F-C12, U-14): a client with an appointment taken
 * elsewhere tells the salon he is here. Reached only from the poster's QR
 * code, whose token comes in the navigation state (never in the URL).
 */
export function CheckInPage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const qrToken = (useLocation().state as { qrToken?: unknown } | null)
    ?.qrToken;
  const salon = useSalon(slug);
  const session = useSession();
  const signedIn = session.data === true;
  const mine = useMyTicket(signedIn);
  const command = useClientCommand();

  const [step, setStep] = useState<Step>('time');
  const [scheduled, setScheduled] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [stylistId, setStylistId] = useState(DONT_KNOW);
  const [known, setKnown] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const checkedIn = useRef(false);
  const profile = useQuery({
    queryKey: ['has-profile'],
    queryFn: hasProfile,
    enabled: signedIn && known === null,
  });
  useEffect(() => {
    if (profile.data !== undefined && known === null) setKnown(profile.data);
  }, [known, profile.data]);

  const title =
    step === 'time'
      ? t('check_in.time.label')
      : step === 'stylist'
        ? t('check_in.stylist.label')
        : step === 'identify'
          ? t('join.steps.identification')
          : t('check_in.summary.title');
  usePageTitle(
    t('check_in.page_title', {
      step: title,
      salon_name: salon.data?.salon.name ?? '',
    }),
  );
  const slots = useMemo(
    () => todaySlots(salon.data?.opening_hours ?? [], Date.now()),
    [salon.data?.opening_hours],
  );

  useEffect(() => {
    if (timeError) document.getElementById('check-in-time')?.focus();
  }, [timeError]);
  useEffect(() => {
    if (nameError) document.getElementById('check-in-first-name')?.focus();
  }, [nameError]);
  // The first name appears after the SMS code of a new account (WCAG 2.4.3).
  useEffect(() => {
    if (step === 'identify' && signedIn && known === false) {
      document.getElementById('check-in-first-name')?.focus();
    }
  }, [known, signedIn, step]);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  if (
    mine.query.data &&
    isActive(mine.query.data.ticket) &&
    !checkedIn.current
  ) {
    return <Navigate replace state={{ already: true }} to="/ticket" />;
  }
  // F-C12: only from the poster; without its token, the salon page.
  if (typeof qrToken !== 'string' || qrToken === '') {
    return <Navigate replace to={`/salons/${slug}`} />;
  }
  if (salon.isPending || session.isPending) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-xl px-5 py-8">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }
  if (!salon.data) return <Navigate replace to={`/salons/${slug}`} />;

  const data = salon.data;
  const steps = STEPS.filter(
    (s) => s !== 'identify' || !signedIn || known === false,
  );
  const index = Math.max(0, steps.indexOf(step));
  const stylist = data.stylists.find((s) => s.id === stylistId);

  function go(next: Step) {
    command.setError(null);
    setStep(next);
  }
  function forward() {
    const next = steps[index + 1];
    if (next) go(next);
  }
  function back() {
    const previous = steps[index - 1];
    if (previous) go(previous);
    else void navigate(-1);
  }

  async function confirm() {
    if (known === false && firstName.trim() === '') {
      setNameError(t('join.summary.first_name_required'));
      return;
    }
    checkedIn.current = true;
    const outcome = await command.run('check_in_appointment', {
      salon_id: data.salon.id,
      qr_token: qrToken,
      scheduled_time: scheduled,
      member_id: stylistId === DONT_KNOW ? null : stylistId,
      service_id: null,
      notifications_consent: consent,
      ...(known === false ? { first_name: firstName.trim() } : {}),
    });
    if (outcome.ok) {
      void navigate('/ticket', { replace: true });
      return;
    }
    checkedIn.current = false;
  }

  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <p className="font-semibold">
        {t('qr.header', { salon_name: data.salon.name })}
      </p>
      <p className="text-body-sm text-text-muted">
        {t('check_in.progress', { step: index + 1, total: steps.length })}
      </p>
      <h1
        className="font-display text-h2 font-bold focus:outline-none"
        ref={heading}
        tabIndex={-1}
      >
        {title}
      </h1>

      {step === 'time' ? (
        slots.length === 0 ? (
          <p>{t('check_in.time.none_today')}</p>
        ) : (
          <div className="grid gap-2">
            <label className="font-semibold" htmlFor="check-in-time">
              {t('check_in.time.choose')}
            </label>
            <select
              aria-describedby={timeError ? 'check-in-time-error' : undefined}
              aria-invalid={timeError ? true : undefined}
              className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
              id="check-in-time"
              onChange={(e) => {
                setTimeError(null);
                setScheduled(e.target.value);
              }}
              value={scheduled}
            >
              <option value="">—</option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {tCommon('formats.time', {
                    hours: slot.slice(0, 2),
                    minutes: slot.slice(3, 5),
                  })}
                </option>
              ))}
            </select>
            {timeError ? (
              <p
                className="font-semibold text-danger-text"
                id="check-in-time-error"
              >
                {timeError}
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {step === 'stylist' ? (
        <fieldset className="grid gap-2">
          <legend className="sr-only">{title}</legend>
          {[
            ...data.stylists.map((s) => ({ id: s.id, label: s.first_name })),
            { id: DONT_KNOW, label: t('check_in.stylist.dont_know') },
          ].map((option) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3"
              key={option.id}
            >
              <input
                checked={stylistId === option.id}
                name="stylist"
                onChange={() => setStylistId(option.id)}
                type="radio"
              />
              <span className="flex-1">{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 'identify' ? (
        signedIn && known === false ? (
          <TextField
            autoComplete="given-name"
            error={nameError ?? undefined}
            helpText={t('signin.first_name.hint')}
            id="check-in-first-name"
            label={t('signin.first_name.label')}
            maxLength={30}
            onChange={(e) => {
              setNameError(null);
              setFirstName(e.target.value);
            }}
            value={firstName}
          />
        ) : (
          <PhoneCode
            onSignedIn={(isKnown) => {
              setKnown(isKnown);
              if (isKnown) go('summary');
            }}
          />
        )
      ) : null}

      {step === 'summary' ? (
        <section className="grid gap-4">
          <dl className="grid gap-2 rounded-xl border border-border p-4">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">{t('check_in.summary.salon')}</dt>
              <dd className="font-semibold">{data.salon.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">{t('check_in.summary.time')}</dt>
              <dd>
                {tCommon('formats.time', {
                  hours: scheduled.slice(0, 2),
                  minutes: scheduled.slice(3, 5),
                })}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">
                {t('check_in.summary.stylist')}
              </dt>
              <dd>{stylist?.first_name ?? t('check_in.stylist.dont_know')}</dd>
            </div>
          </dl>
          <div className="flex items-start gap-3">
            <input
              aria-describedby="check-in-consent-hint"
              checked={consent}
              className="mt-1 size-5"
              id="check-in-consent"
              onChange={(e) => setConsent(e.target.checked)}
              type="checkbox"
            />
            <div className="grid gap-1">
              <label className="font-semibold" htmlFor="check-in-consent">
                {t('join.summary.consent')}
              </label>
              <p
                className="text-body-sm text-text-muted"
                id="check-in-consent-hint"
              >
                {t('join.summary.consent_hint')}
              </p>
            </div>
          </div>
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          <Button
            fullWidth
            loading={command.busy === 'check_in_appointment'}
            onClick={() => void confirm()}
            size="lg"
          >
            {t('check_in.confirm')}
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button onClick={back} variant="ghost">
          {tCommon('actions.back')}
        </Button>
        {step === 'time' && slots.length > 0 ? (
          <Button
            onClick={() =>
              scheduled === ''
                ? setTimeError(t('check_in.time.required'))
                : forward()
            }
          >
            {tCommon('actions.next')}
          </Button>
        ) : step === 'stylist' ? (
          <Button onClick={forward}>{tCommon('actions.next')}</Button>
        ) : step === 'identify' && signedIn && known === false ? (
          <Button
            onClick={() => {
              if (firstName.trim() === '') {
                setNameError(t('join.summary.first_name_required'));
                return;
              }
              forward();
            }}
          >
            {tCommon('actions.next')}
          </Button>
        ) : null}
      </div>
      {step === 'time' && slots.length === 0 ? (
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-link underline"
          to={`/salons/${slug}`}
        >
          {data.salon.name}
        </Link>
      ) : null}
    </main>
  );
}
