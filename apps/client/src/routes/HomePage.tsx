import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AddressField, Banner, Button, Skeleton } from '@zelate/ui';
import { searchPlaces } from '../lib/address';
import { isActive, searchSalons } from '../lib/client-api';
import type { SalonResult } from '../lib/client-api';
import {
  useMyTicket,
  useNow,
  usePageTitle,
  useSession,
  useTime,
} from '../lib/live';

// MapLibre weighs more than the rest of the page: loaded with the tab (TRD §3).
const SalonsMap = lazy(() => import('../components/SalonsMap'));

const RADIUS_M = 5_000;
const WIDE_RADIUS_M = 10_000;
/** « à vérifier » beyond 5 min without an update (F-C1). */
const STALE_MINUTES = 5;

type Place = { lat: number; lng: number; fromDevice: boolean };

function SalonCard({ salon, now }: { salon: SalonResult; now: number }) {
  const { t } = useTranslation('client');
  const time = useTime();
  const age =
    salon.estimate_updated_at === null
      ? null
      : Math.max(
          0,
          Math.floor((now - Date.parse(salon.estimate_updated_at)) / 60_000),
        );
  const state =
    salon.queue_status === 'open'
      ? salon.is_full
        ? t('home.queue_state.full')
        : null
      : t(`home.queue_state.${salon.queue_status}`);
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
          {salon.queue_status === 'open' &&
          !salon.is_full &&
          salon.current_wait_minutes !== null ? (
            <span className="rounded-full bg-primary-subtle px-3 py-0.5 font-semibold text-link tabular-nums">
              {t('home.wait_badge', { minutes: salon.current_wait_minutes })}
            </span>
          ) : null}
        </span>
        <span className="text-body-sm text-text-muted">
          {[distance, salon.address_line, state].filter(Boolean).join(' · ')}
        </span>
        {salon.next_free_slot ? (
          <span className="text-body-sm font-semibold text-success-text">
            {t('home.next_free_slot', {
              time: time(salon.next_free_slot.start_at),
              service_name: salon.next_free_slot.service_name,
            })}
          </span>
        ) : null}
        {age !== null && salon.queue_status === 'open' ? (
          <span className="text-body-sm text-text-muted">
            {age > STALE_MINUTES
              ? t('home.freshness_stale')
              : t('home.freshness', { minutes: age })}
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

  function locate() {
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
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
  const all = results.data ?? [];
  const shown = openOnly ? all.filter((s) => s.queue_status === 'open') : all;
  const active = mine.query.data && isActive(mine.query.data.ticket);

  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <header className="grid gap-2">
        <p className="font-display text-h2 font-bold">
          {tCommon('brand.client_name')}
        </p>
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
            <div
              aria-label={t('home.tabs.list')}
              className="flex gap-2"
              role="group"
            >
              {(['list', 'map'] as const).map((value) => (
                <Button
                  aria-pressed={tab === value}
                  key={value}
                  onClick={() => {
                    setTab(value);
                    if (value === 'map') setMapOpened(true);
                  }}
                  size="sm"
                  variant={tab === value ? 'primary' : 'secondary'}
                >
                  {t(`home.tabs.${value}`)}
                </Button>
              ))}
            </div>
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
