import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { parisDate, parisInstant } from '@zelate/queue-service/time';
import { Banner, Button, Skeleton, TextField } from '@zelate/ui';
import { PhoneCode } from '../components/PhoneCode';
import { hasProfile } from '../lib/auth-api';
import { fullToday, openness } from '../lib/salon-summary';
import { isActive } from '../lib/client-api';
import {
  useClientCommand,
  useMyTicket,
  usePageTitle,
  useSalon,
  useSession,
  useTime,
} from '../lib/live';

type Step = 'service' | 'stylist' | 'arrival' | 'identify' | 'summary';
const STEPS: Step[] = ['service', 'stylist', 'arrival', 'identify', 'summary'];
const UNKNOWN = 'unknown';
const FIRST_AVAILABLE = '';
const CLOSED_CODES = ['queue_closed', 'queue_paused', 'queue_full'];

const latest = (a: string | null, b: string): string =>
  a !== null && Date.parse(a) > Date.parse(b) ? a : b;

/**
 * `/salons/:slug/join` (F-C3, U-04) and its QR variant `?via=qr` (F-C4,
 * U-05): service, stylist, arrival time, SMS code, then the summary and
 * `join_queue`. Going back never loses a choice.
 */
export function JoinPage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const viaQr = params.get('via') === 'qr';
  const salon = useSalon(slug);
  const session = useSession();
  const signedIn = session.data === true;
  const mine = useMyTicket(signedIn);
  const command = useClientCommand();

  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [stylistId, setStylistId] = useState(FIRST_AVAILABLE);
  const [later, setLater] = useState(false);
  const [arrival, setArrival] = useState('');
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  // Signed in during step 4; `false` asks the first name (K30).
  const [known, setKnown] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const joined = useRef(false);
  // Signed in before (an SMS code on /signin, then the app closed): his first
  // name may still be missing, and `join_queue` would refuse (K30).
  const profile = useQuery({
    queryKey: ['has-profile'],
    queryFn: hasProfile,
    enabled: signedIn && known === null,
  });
  useEffect(() => {
    if (profile.data !== undefined && known === null) setKnown(profile.data);
  }, [known, profile.data]);
  const title = t(
    `join.steps.${step === 'identify' ? 'identification' : step}`,
  );
  usePageTitle(
    t('join.page_title', {
      step: title,
      salon_name: salon.data?.salon.name ?? '',
    }),
  );
  // An error is linked to its field once rendered, then focused (WCAG 3.3.1).
  useEffect(() => {
    if (arrivalError) document.getElementById('arrival-time')?.focus();
  }, [arrivalError]);
  useEffect(() => {
    if (nameError) document.getElementById('join-first-name')?.focus();
  }, [nameError]);
  useEffect(() => {
    if (serviceError) document.getElementById('service-error')?.focus();
  }, [serviceError]);
  useEffect(() => {
    if (step === 'identify' && signedIn && known === false) {
      document.getElementById('join-first-name')?.focus();
    }
  }, [known, signedIn, step]);

  // Each step moves the focus to its heading (WCAG 2.4.3).
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  // A place created by this page leads to /ticket without « déjà une place ».
  if (mine.query.data && isActive(mine.query.data.ticket) && !joined.current) {
    // APP_FLOW §2.3: one active place at a time.
    return <Navigate replace state={{ already: true }} to="/ticket" />;
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
  // Closed, paused or full: the salon page says why, before any step (F-C2).
  const salonState = openness(
    data.salon.queue_status,
    data.closes_at,
    Date.now(),
  );
  if (
    !joined.current &&
    (salonState !== 'open' ||
      fullToday(
        data.salon.is_full,
        data.first_available_wait_minutes,
        data.closes_at,
        Date.now(),
      ))
  ) {
    return <Navigate replace to={`/salons/${slug}`} />;
  }
  const steps = STEPS.filter(
    (s) => s !== 'identify' || !signedIn || known === false,
  );
  const index = Math.max(0, steps.indexOf(step));
  const service = data.services.find((s) => s.id === serviceId);
  const stylist = data.stylists.find((s) => s.id === stylistId);
  const wait = data.first_available_wait_minutes;
  const asap =
    wait === null ? null : new Date(Date.now() + wait * 60_000).toISOString();

  function go(next: Step) {
    command.setError(null);
    setRefusal(null);
    setStep(next);
  }
  function forward() {
    const next = steps[index + 1];
    if (next) go(next);
  }
  function back() {
    const previous = steps[index - 1];
    if (previous) go(previous);
    else void navigate(`/salons/${slug}`);
  }

  function arrivalInstant(): string | null {
    if (!later || !/^\d{2}:\d{2}$/.test(arrival)) return null;
    return new Date(parisInstant(parisDate(Date.now()), arrival)).toISOString();
  }

  function confirmArrival() {
    if (later) {
      const at = arrivalInstant();
      if (!at || Date.parse(at) <= Date.now()) {
        setArrivalError(t('join.arrival.time_future'));
        return;
      }
    }
    setArrivalError(null);
    forward();
  }

  async function confirm() {
    if (known === false && firstName.trim() === '') {
      setNameError(t('join.summary.first_name_required'));
      return;
    }
    const at = arrivalInstant();
    joined.current = true;
    const outcome = await command.run('join_queue', {
      salon_id: data.salon.id,
      channel: viaQr ? 'qr' : 'app',
      ...(serviceId === UNKNOWN || serviceId === null
        ? { unknown_service: true }
        : { service_id: serviceId }),
      ...(stylistId !== FIRST_AVAILABLE
        ? { requested_member_id: stylistId }
        : {}),
      ...(at ? { declared_arrival_at: at } : {}),
      notifications_consent: consent,
      ...(known === false ? { first_name: firstName.trim() } : {}),
    });
    if (outcome.ok) {
      void navigate('/ticket', { replace: true });
      return;
    }
    joined.current = false;
    setRefusal(outcome.code);
  }

  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      {viaQr ? (
        <p className="font-semibold">
          {t('qr.header', { salon_name: data.salon.name })}
        </p>
      ) : (
        <p className="text-text-muted">{data.salon.name}</p>
      )}
      <p className="text-body-sm text-text-muted">
        {t('join.progress', { step: index + 1, total: steps.length })}
      </p>
      <h1
        className="font-display text-h2 font-bold focus:outline-none"
        ref={heading}
        tabIndex={-1}
      >
        {title}
      </h1>

      {step === 'service' ? (
        <fieldset
          aria-describedby={serviceError ? 'service-error' : undefined}
          className="grid gap-2"
        >
          {serviceError ? (
            <p
              className="font-semibold text-danger-text focus:outline-none"
              id="service-error"
              role="alert"
              tabIndex={-1}
            >
              {serviceError}
            </p>
          ) : null}
          <legend className="sr-only">{title}</legend>
          {[
            ...data.services.map((s) => ({
              id: s.id,
              label: s.name,
              hint: tCommon('units.minutes', { count: s.duration_minutes }),
            })),
            { id: UNKNOWN, label: t('join.service.unknown'), hint: '' },
          ].map((option) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3"
              key={option.id}
            >
              <input
                checked={serviceId === option.id}
                name="service"
                onChange={() => {
                  setServiceError(null);
                  setServiceId(option.id);
                }}
                type="radio"
              />
              <span className="flex-1">{option.label}</span>
              <span className="text-body-sm text-text-muted">
                {option.hint}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 'stylist' ? (
        <fieldset className="grid gap-2">
          <legend className="sr-only">{title}</legend>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3">
            <input
              checked={stylistId === FIRST_AVAILABLE}
              name="stylist"
              onChange={() => setStylistId(FIRST_AVAILABLE)}
              type="radio"
            />
            <span className="flex-1">{t('join.stylist.first_available')}</span>
            {asap ? (
              <span className="text-body-sm text-text-muted">
                {t('join.stylist.estimated_time', { time: time(asap) })}
              </span>
            ) : null}
          </label>
          {data.stylists.map((s) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3"
              key={s.id}
            >
              <input
                checked={stylistId === s.id}
                name="stylist"
                onChange={() => setStylistId(s.id)}
                type="radio"
              />
              <span className="flex-1">{s.first_name}</span>
              <span className="text-body-sm text-text-muted">
                {t(`salon.stylist.status.${s.presence}`)}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 'arrival' ? (
        <fieldset className="grid gap-2">
          <legend className="sr-only">{title}</legend>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3">
            <input
              checked={!later}
              name="arrival"
              onChange={() => setLater(false)}
              type="radio"
            />
            {t('join.arrival.asap')}
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3">
            <input
              checked={later}
              name="arrival"
              onChange={() => setLater(true)}
              type="radio"
            />
            {t('join.arrival.around')}
          </label>
          {later ? (
            <TextField
              error={arrivalError ?? undefined}
              id="arrival-time"
              label={t('join.arrival.time_picker_label')}
              onChange={(e) => {
                setArrivalError(null);
                setArrival(e.target.value);
              }}
              step={300}
              type="time"
              value={arrival}
            />
          ) : null}
        </fieldset>
      ) : null}

      {step === 'identify' ? (
        signedIn && known === false ? (
          <TextField
            autoComplete="given-name"
            error={nameError ?? undefined}
            helpText={t('signin.first_name.hint')}
            id="join-first-name"
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
              // Known client: straight to the summary; otherwise his first name here.
              if (isKnown) go('summary');
            }}
          />
        )
      ) : null}

      {step === 'summary' ? (
        <section className="grid gap-4">
          <dl className="grid gap-2 rounded-xl border border-border p-4">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">{t('join.summary.salon')}</dt>
              <dd className="font-semibold">{data.salon.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">{t('join.summary.service')}</dt>
              <dd>{service?.name ?? t('join.service.unknown')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">{t('join.summary.stylist')}</dt>
              <dd>
                {stylist?.first_name ?? t('join.stylist.first_available')}
              </dd>
            </div>
            {asap ? (
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">
                  {t('join.summary.estimated_time')}
                </dt>
                {/* Never earlier than the estimate: arriving early does not move the queue. */}
                <dd>{time(latest(arrivalInstant(), asap))}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-body-sm">{t('join.summary.call_rule')}</p>
          <div className="flex items-start gap-3">
            <input
              aria-describedby="consent-hint"
              checked={consent}
              className="mt-1 size-5"
              id="join-consent"
              onChange={(e) => setConsent(e.target.checked)}
              type="checkbox"
            />
            <div className="grid gap-1">
              <label className="font-semibold" htmlFor="join-consent">
                {t('join.summary.consent')}
              </label>
              <p className="text-body-sm text-text-muted" id="consent-hint">
                {t('join.summary.consent_hint')}
              </p>
            </div>
          </div>
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          {refusal === 'already_has_active_ticket' ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-link underline"
              to="/ticket"
            >
              {t('join.view_my_ticket')}
            </Link>
          ) : refusal && CLOSED_CODES.includes(refusal) ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-link underline"
              to="/"
            >
              {t('nearby_salons.link')}
            </Link>
          ) : null}
          <Button
            fullWidth
            loading={command.busy === 'join_queue'}
            onClick={() => void confirm()}
            size="lg"
          >
            {t('join.confirm')}
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button onClick={back} variant="ghost">
          {tCommon('actions.back')}
        </Button>
        {step === 'service' || step === 'stylist' ? (
          <Button
            onClick={() =>
              step === 'service' && serviceId === null
                ? setServiceError(t('join.service.required'))
                : forward()
            }
          >
            {tCommon('actions.next')}
          </Button>
        ) : step === 'arrival' ? (
          <Button onClick={confirmArrival}>{tCommon('actions.next')}</Button>
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
    </main>
  );
}
