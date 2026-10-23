import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AddressField, Banner, Button, Skeleton } from '@zelate/ui';
import { searchPlaces } from '../lib/address';
import { isActive, searchSalons } from '../lib/client-api';
import type { SalonResult } from '../lib/client-api';
import { useMyTicket, useNow, usePageTitle, useSession } from '../lib/live';
import { BADGE_CLASSES, openness, useSalonSummary } from '../lib/salon-summary';

// MapLibre weighs more than the rest of the page: loaded with the tab (TRD §3).
const SalonsMap = lazy(() => import('../components/SalonsMap'));

const RADIUS_M = 5_000;
const WIDE_RADIUS_M = 10_000;

type Place = { lat: number; lng: number; fromDevice: boolean };

function SalonCard({ salon, now }: { salon: SalonResult; now: number }) {
  const { t } = useTranslation('client');
  const summary = useSalonSummary()(salon, now);
  const distance =
    salon.distance_m < 1_000
      ? t('home.distance.m', { meters: Math.round(salon.distance_m / 10) * 10 })
      : t('home.distance.km', {
          km: (salon.distance_m / 1_000).toLocaleString('fr-FR', {
            maximumFractionDigits: 1,
          }),
        });
  return (
    <li>
      <Link
        className="grid gap-1 rounded-xl border border-border bg-surface p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-focus-ring"
        to={`/salons/${salon.slug}`}
      >
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-h3 font-semibold">{salon.name}</span>
          {summary.badge ? (
            <span
              className={`rounded-full px-3 py-0.5 font-semibold tabular-nums ${BADGE_CLASSES[summary.badge.tone]}`}
            >
              {summary.badge.text}
            </span>
          ) : null}
        </span>
        <span className="text-body-sm text-text-muted">
          {[distance, salon.address_line, summary.state]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {summary.slot ? (
          <span className="text-body-sm font-semibold text-success-text">
            {summary.slot}
          </span>
        ) : null}
        {summary.freshness ? (
          <span className="text-body-sm text-text-muted">
            {summary.freshness}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** `/` (F-C1, U-01, U-16): salons around me, as a list or on a map. */
export function HomePage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  usePageTitle(t('home.page_title'));
  const session = useSession();
  const mine = useMyTicket(session.data === true);
  const now = useNow(60_000);
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [askAddress, setAskAddress] = useState(false);
  const [radius, setRadius] = useState(RADIUS_M);
  const [openOnly, setOpenOnly] = useState(true);
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [mapOpened, setMapOpened] = useState(false);
  // A chosen address wins over a position that arrives later.
  const addressChosen = useRef(false);

  function locate() {
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        if (addressChosen.current) return;
        setRadius(RADIUS_M);
        setPlace({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          fromDevice: true,
        });
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  // Asked once: the explanation comes first, the system prompt only on a tap.
  // A permission already granted is used straight away.
  useEffect(() => {
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') locate();
        if (status.state === 'denied') setDenied(true);
      })
      .catch(() => undefined);
  }, []);

  const results = useQuery({
    queryKey: ['search', place?.lat, place?.lng, radius],
    queryFn: () => searchSalons(place!.lat, place!.lng, radius),
    enabled: place !== null,
    refetchInterval: 60_000,
  });
  // The same array between renders: the map keeps its markers, and the focus.
  const shown = useMemo(() => {
    const all = results.data ?? [];
    // « Ouvert maintenant »: open by its hours too; full queues stay, marked.
    const at = Date.now();
    return openOnly
      ? all.filter((s) => openness(s.queue_status, s.closes_at, at) === 'open')
      : all;
  }, [openOnly, results.data]);
  const active = mine.query.data && isActive(mine.query.data.ticket);

  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-h2 font-bold">
            {tCommon('brand.client_name')}
          </p>
          {/* APP_FLOW §2.1: the account, for a signed-in client. */}
          {session.data === true ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-link underline"
              to="/account"
            >
              {t('account.link')}
            </Link>
          ) : null}
        </div>
        <h1 className="text-h3">{t('home.title')}</h1>
      </header>

      {active ? (
        <Banner tone="info">
          <Link
            className="inline-flex min-h-11 items-center font-semibold underline"
            to="/ticket"
          >
            {t('home.active_ticket_banner')}
          </Link>
        </Banner>
      ) : null}

      {place === null || askAddress ? (
        <section className="grid gap-3">
          {denied ? (
            <p className="text-body">{t('home.geolocation.denied')}</p>
          ) : (
            <p className="text-body text-text-muted">
              {t('home.geolocation.explanation')}
            </p>
          )}
          {!denied ? (
            <Button fullWidth loading={locating} onClick={locate} size="lg">
              {locating ? t('home.locating') : t('home.geolocation.allow')}
            </Button>
          ) : null}
          {denied || askAddress ? null : (
            <Button
              fullWidth
              onClick={() => setAskAddress(true)}
              size="lg"
              variant="secondary"
            >
              {t('home.geolocation.use_address')}
            </Button>
          )}
        </section>
      ) : null}

      {denied || askAddress || place !== null ? (
        <AddressField
          helpText={t('home.search.hint')}
          label={t('home.search.label')}
          noResultsText={t('home.search.no_results')}
          onSearch={searchPlaces}
          onSelect={(suggestion) => {
            if (!suggestion) return;
            addressChosen.current = true;
            setLocating(false);
            setRadius(RADIUS_M);
            setAskAddress(false);
            setPlace({
              lat: suggestion.latitude,
              lng: suggestion.longitude,
              fromDevice: false,
            });
          }}
        />
      ) : null}

      {place !== null ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* SegmentedControl (DESIGN_SYSTEM): native radios, arrow keys included. */}
            <fieldset className="flex rounded-lg border border-border-strong p-1">
              <legend className="sr-only">{t('home.display_label')}</legend>
              {(['list', 'map'] as const).map((value) => (
                <label
                  className={`flex min-h-11 cursor-pointer items-center rounded-md px-4 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus-ring ${
                    tab === value ? 'bg-primary text-text-on-primary' : ''
                  }`}
                  key={value}
                >
                  <input
                    checked={tab === value}
                    className="sr-only"
                    name="home-display"
                    onChange={() => {
                      setTab(value);
                      if (value === 'map') setMapOpened(true);
                    }}
                    type="radio"
                  />
                  {t(`home.tabs.${value}`)}
                </label>
              ))}
            </fieldset>
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input
                checked={openOnly}
                className="size-6"
                onChange={(e) => setOpenOnly(e.target.checked)}
                type="checkbox"
              />
              {t('home.filters.open_now')}
            </label>
          </div>

          <h2 aria-live="polite" className="text-body font-semibold">
            {results.isSuccess
              ? t('home.results_title', { count: shown.length })
              : ''}
          </h2>

          {results.isError ? (
            <Banner role="alert" tone="danger">
              {t('home.error')}
            </Banner>
          ) : results.isPending ? (
            <div aria-busy="true" className="grid gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : shown.length === 0 ? (
            <section className="grid gap-3">
              <p>
                {radius === RADIUS_M
                  ? t('home.empty.message')
                  : t('home.empty.message_widened')}
              </p>
              {radius === RADIUS_M ? (
                <Button
                  onClick={() => setRadius(WIDE_RADIUS_M)}
                  variant="secondary"
                >
                  {t('home.empty.widen')}
                </Button>
              ) : null}
            </section>
          ) : null}

          {tab === 'list' && shown.length > 0 ? (
            <ul className="grid gap-3">
              {shown.map((salon) => (
                <SalonCard key={salon.id} now={now} salon={salon} />
              ))}
            </ul>
          ) : null}

          {mapOpened ? (
            <div hidden={tab !== 'map'}>
              <Suspense
                fallback={
                  <p aria-busy="true" className="text-text-muted">
                    {t('home.map.loading')}
                  </p>
                }
              >
                <SalonsMap
                  center={{ lat: place.lat, lng: place.lng }}
                  me={
                    place.fromDevice ? { lat: place.lat, lng: place.lng } : null
                  }
                  salons={shown}
                />
              </Suspense>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
