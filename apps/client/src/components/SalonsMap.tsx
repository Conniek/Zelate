import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { SalonResult } from '../lib/client-api';
import { useNow } from '../lib/live';
import { groupByDistance, groupKey } from '../lib/map-groups';
import { BADGE_CLASSES, useSalonSummary } from '../lib/salon-summary';

/** OpenFreeMap: free tiles, no key, not openstreetmap.org's own servers (TRD §3). */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** Pills closer than this on screen would overlap: they become one group. */
const GROUP_RADIUS_PX = 56;
const CARD_ID = 'map-salon-card';

interface Props {
  center: { lat: number; lng: number };
  salons: SalonResult[];
  /** « Me localiser »: when given, the button recentres on this point. */
  me: { lat: number; lng: number } | null;
}

interface Shown {
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
  ids: string[];
}

const PILL =
  'min-h-11 min-w-11 rounded-full border border-border px-3 font-semibold shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

/**
 * F-C1 map, loaded only when the « Carte » tab opens (TRD §3). Markers are
 * compact pills (wait, « Complet », « Fermé »); salons too close to read
 * become one « 3 salons » pill that zooms in when touched. Touching a salon
 * opens a small card at the bottom of the map. Every marker is a real
 * button, so the map works with a keyboard and a screen reader; the list
 * stays the main way to choose.
 */
export default function SalonsMap({ center, salons, me }: Props) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const shown = useRef(new Map<string, Shown>());
  const summarize = useSalonSummary();
  // Rebuilt every 5 min at most: a new minute does not drop a focused marker.
  const now = useNow(5 * 60_000);
  const [moves, setMoves] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const cardHeading = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLElement>(null);

  const initial = useRef(center);
  useEffect(() => {
    if (!box.current) return undefined;
    const instance = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [initial.current.lng, initial.current.lat],
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.current = instance;
    // Groups are worked out again once a move ends, never during it.
    const moved = () => setMoves((n) => n + 1);
    instance.on('moveend', moved);
    instance.on('load', moved);
    const markers = shown.current;
    return () => {
      markers.forEach((s) => s.marker.remove());
      markers.clear();
      instance.remove();
      map.current = null;
    };
    // Created once: the centre then moves with flyTo below.
  }, []);

  useEffect(() => {
    map.current?.flyTo({ center: [center.lng, center.lat] });
  }, [center.lat, center.lng]);

  // A salon gone from the list (filter, new search) closes its card.
  useEffect(() => {
    if (selected && !salons.some((s) => s.id === selected)) setSelected(null);
  }, [salons, selected]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const byId = new Map(salons.map((s) => [s.id, s]));
    const groups = groupByDistance(
      salons.map((s) => {
        const p = instance.project([s.longitude, s.latitude]);
        return { id: s.id, x: p.x, y: p.y };
      }),
      GROUP_RADIUS_PX,
    );
    const keep = new Set<string>();
    for (const ids of groups) {
      const key = groupKey(ids);
      keep.add(key);
      const members = ids.map((id) => byId.get(id)!);
      const lng = members.reduce((a, s) => a + s.longitude, 0) / ids.length;
      const lat = members.reduce((a, s) => a + s.latitude, 0) / ids.length;
      let entry = shown.current.get(key);
      if (!entry) {
        const element = document.createElement('button');
        element.type = 'button';
        element.addEventListener('click', () => {
          if (ids.length === 1) {
            setSelected(ids[0]!);
            return;
          }
          const bounds = new maplibregl.LngLatBounds();
          members.forEach((s) => bounds.extend([s.longitude, s.latitude]));
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          if (sw.lng === ne.lng && sw.lat === ne.lat) {
            instance.easeTo({ center: sw, zoom: instance.getZoom() + 2 });
          } else {
            instance.fitBounds(bounds, { padding: 80, maxZoom: 18 });
          }
        });
        entry = {
          marker: new maplibregl.Marker({ element }).setLngLat([lng, lat]),
          element,
          ids,
        };
        entry.marker.addTo(instance);
        shown.current.set(key, entry);
      } else {
        entry.marker.setLngLat([lng, lat]);
      }
      const { element } = entry;
      if (ids.length === 1) {
        // The marker says what the list card says (U-01, U-16).
        const salon = members[0]!;
        const summary = summarize(salon, now);
        element.className = `${PILL} ${
          summary.badge
            ? BADGE_CLASSES[summary.badge.tone]
            : 'bg-surface text-text'
        }`;
        element.textContent = summary.badge?.text ?? salon.name;
        element.setAttribute(
          'aria-label',
          [salon.name, summary.badge?.text, summary.state, summary.slot]
            .filter(Boolean)
            .join(', '),
        );
        element.setAttribute('aria-expanded', String(selected === salon.id));
        element.setAttribute('aria-controls', CARD_ID);
      } else {
        element.className = `${PILL} bg-primary text-text-on-primary`;
        element.textContent = t('home.map.group', { count: ids.length });
        element.setAttribute(
          'aria-label',
          t('home.map.group_aria', {
            count: ids.length,
            names: members.map((s) => s.name).join(', '),
          }),
        );
        element.removeAttribute('aria-expanded');
        element.removeAttribute('aria-controls');
      }
    }
    for (const [key, entry] of shown.current) {
      if (!keep.has(key)) {
        entry.marker.remove();
        shown.current.delete(key);
      }
    }
  }, [moves, now, salons, selected, summarize, t]);

  // The card takes the focus when it opens (WCAG 2.4.3).
  useEffect(() => {
    if (selected) cardHeading.current?.focus();
  }, [selected]);

  const close = useCallback(() => {
    const id = selected;
    setSelected(null);
    // Back to the salon's marker, or its group if the map moved since.
    for (const entry of shown.current.values()) {
      if (id && entry.ids.includes(id)) {
        entry.element.focus();
        break;
      }
    }
  }, [selected]);

  // Échap closes the card while the focus is in it.
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        card.current?.contains(document.activeElement)
      ) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, selected]);

  const salon = selected ? salons.find((s) => s.id === selected) : undefined;
  const summary = salon ? summarize(salon, now) : null;

  return (
    <div className="grid gap-2">
      <div className="relative">
        <div
          aria-label={t('home.map.aria_label')}
          className="h-[60vh] min-h-72 w-full overflow-hidden rounded-xl border border-border"
          ref={box}
          role="region"
        />
        {salon && summary ? (
          <section
            aria-labelledby="map-salon-name"
            className="absolute inset-x-3 bottom-3 grid gap-2 rounded-xl border border-border bg-surface p-4 shadow-lg"
            id={CARD_ID}
            ref={card}
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                className="text-h3 font-semibold focus:outline-none"
                id="map-salon-name"
                ref={cardHeading}
                tabIndex={-1}
              >
                {salon.name}
              </h3>
              {summary.badge ? (
                <span
                  className={`shrink-0 rounded-full px-3 py-0.5 font-semibold tabular-nums ${BADGE_CLASSES[summary.badge.tone]}`}
                >
                  {summary.badge.text}
                </span>
              ) : null}
            </div>
            <p className="text-body-sm text-text-muted">
              {[salon.address_line, summary.state].filter(Boolean).join(' · ')}
            </p>
            {summary.slot ? (
              <p className="text-body-sm font-semibold text-success-text">
                {summary.slot}
              </p>
            ) : null}
            {summary.freshness ? (
              <p className="text-body-sm text-text-muted">
                {summary.freshness}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-text-on-primary"
                to={`/salons/${salon.slug}`}
              >
                {t('home.map.view_salon')}
              </Link>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-semibold"
                onClick={close}
                type="button"
              >
                {tCommon('actions.close')}
              </button>
            </div>
          </section>
        ) : null}
      </div>
      {me ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-semibold"
          onClick={() =>
            map.current?.flyTo({ center: [me.lng, me.lat], zoom: 14 })
          }
          type="button"
        >
          {t('home.map.locate_me')}
        </button>
      ) : null}
    </div>
  );
}
