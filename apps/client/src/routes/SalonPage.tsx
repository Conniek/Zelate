import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Banner, Button, Skeleton } from '@zelate/ui';
import { isActive } from '../lib/client-api';
import type { PublicSalon } from '../lib/client-api';
import {
  useMyTicket,
  usePageTitle,
  useSalon,
  useSession,
  useTime,
} from '../lib/live';

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function Hours({ hours }: { hours: PublicSalon['opening_hours'] }) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const hhmm = (value: string) => {
    const [h, m] = value.split(':');
    return tCommon('formats.time', { hours: String(Number(h)), minutes: m });
  };
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="min-h-11 cursor-pointer font-semibold">
        {t('salon.hours.title')}
      </summary>
      <dl className="mt-2 grid gap-1">
        {WEEKDAYS.map((day, index) => {
          const ranges = hours.filter((h) => h.weekday === index + 1);
          return (
            <div className="flex justify-between gap-4" key={day}>
              <dt className="capitalize">{tCommon(`weekdays.${day}`)}</dt>
              <dd className="tabular-nums">
                {ranges.length === 0
                  ? t('salon.closed_today')
                  : ranges
                      .map((r) =>
                        tCommon('formats.time_range', {
                          start: hhmm(r.opens_at),
                          end: hhmm(r.closes_at),
                        }),
                      )
                      .join(', ')}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

/** `/salons/:slug` (F-C2, U-02): the salon, its wait and its services. */
export function SalonPage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  const session = useSession();
  const mine = useMyTicket(session.data === true);
  usePageTitle(salon.data?.salon.name ?? t('salon.not_found.title'));

  if (salon.isPending) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-xl px-5 py-8">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }
  if (!salon.data) {
    return (
      <main className="mx-auto grid w-full max-w-xl gap-3 px-5 py-8">
        <h1 className="font-display text-h2 font-bold">
          {t('salon.not_found.title')}
        </h1>
        <p className="text-text-muted">{t('salon.not_found.body')}</p>
        <Link className="font-semibold text-link underline" to="/">
          {t('nearby_salons.link')}
        </Link>
      </main>
    );
  }

  const data = salon.data;
  const s = data.salon;
  const wait = data.first_available_wait_minutes;
  const slots = new Map(
    (s.next_free_slots ?? []).map((x) => [x.service_id, x.start_at]),
  );
  const blocked =
    s.queue_status === 'closed'
      ? t('salon.join_disabled.closed')
      : s.queue_status === 'paused'
        ? t('salon.join_disabled.paused')
        : s.is_full
          ? t('salon.join_disabled.full')
          : null;
  const active = mine.query.data && isActive(mine.query.data.ticket);
  const address = `${s.address_line}, ${s.postal_code} ${s.city}`;

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-5 py-8">
      {active ? (
        <Banner tone="info">
          <Link className="font-semibold underline" to="/ticket">
            {t('home.active_ticket_banner')}
          </Link>
        </Banner>
      ) : null}
      <header className="grid gap-2">
        <h1 className="font-display text-h1 font-bold">{s.name}</h1>
        <p className="text-text-muted">{address}</p>
        {s.welcome_message ? <p>{s.welcome_message}</p> : null}
      </header>

      <section
        aria-labelledby="wait-title"
        className="grid gap-1 rounded-xl bg-surface-muted p-4"
      >
        <h2 className="font-semibold" id="wait-title">
          {t('salon.wait.title')}
        </h2>
        <p className="text-h3">
          {t('salon.wait.people_ahead', { count: data.waiting_count })}
        </p>
        {wait !== null && s.queue_status === 'open' ? (
          <p>
            {t('salon.wait.estimated_time', {
              time: time(new Date(Date.now() + wait * 60_000).toISOString()),
            })}
          </p>
        ) : null}
        <p className="text-body-sm text-text-muted">
          {tCommon(`queue_status.${s.is_full ? 'full' : s.queue_status}`)}
        </p>
      </section>

      <div className="grid gap-2">
        {blocked ? (
          <>
            <p className="text-body-sm text-text-muted" id="join-blocked">
              {blocked}
            </p>
            <Button
              aria-describedby="join-blocked"
              aria-disabled
              fullWidth
              size="lg"
            >
              {t('salon.join')}
            </Button>
            {s.is_full ? (
              <Link className="text-link underline" to="/">
                {t('nearby_salons.link')}
              </Link>
            ) : null}
          </>
        ) : (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
            to={`/salons/${s.slug}/join`}
          >
            {t('salon.join')}
          </Link>
        )}
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-semibold"
          href={`https://maps.apple.com/?daddr=${encodeURIComponent(address)}`}
          rel="noreferrer"
          target="_blank"
        >
          {tCommon('actions.directions')}
        </a>
      </div>

      <section aria-labelledby="services-title" className="grid gap-2">
        <h2 className="text-h3" id="services-title">
          {t('salon.services.title')}
        </h2>
        <ul className="grid gap-2">
          {data.services.map((service) => {
            const slot = slots.get(service.id);
            return (
              <li
                className="grid gap-0.5 rounded-lg border border-border p-3"
                key={service.id}
              >
                <span className="flex justify-between gap-3">
                  <span className="font-semibold">{service.name}</span>
                  <span className="tabular-nums">
                    {t('salon.service_line', {
                      duration: tCommon('units.minutes', {
                        count: service.duration_minutes,
                      }),
                      price: tCommon('units.price', {
                        amount: (service.price_cents / 100).toLocaleString(
                          'fr-FR',
                        ),
                      }),
                    })}
                  </span>
                </span>
                {slot && s.queue_status === 'open' ? (
                  <span className="text-body-sm text-success-text">
                    {t('salon.services.next_free_slot', { time: time(slot) })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {slots.size > 0 && s.queue_status === 'open' ? (
          <p className="text-body-sm text-text-muted">
            {t('salon.free_slot_hint')}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="stylists-title" className="grid gap-2">
        <h2 className="text-h3" id="stylists-title">
          {t('salon.stylists.title')}
        </h2>
        <ul className="grid gap-1">
          {data.stylists.map((stylist) => (
            <li className="flex justify-between gap-3" key={stylist.id}>
              <span className="font-semibold">{stylist.first_name}</span>
              <span className="text-text-muted">
                {t(`salon.stylist.status.${stylist.presence}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Hours hours={data.opening_hours} />
    </main>
  );
}
