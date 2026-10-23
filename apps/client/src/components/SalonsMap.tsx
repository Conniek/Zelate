import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { SalonResult } from '../lib/client-api';
import { useNow } from '../lib/live';
import { BADGE_CLASSES, useSalonSummary } from '../lib/salon-summary';

/** OpenFreeMap: free tiles, no key, not openstreetmap.org's own servers (TRD §3). */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  center: { lat: number; lng: number };
  salons: SalonResult[];
  /** « Me localiser »: when given, the button recentres on this point. */
  me: { lat: number; lng: number } | null;
}

/**
 * F-C1 map, loaded only when the « Carte » tab opens (TRD §3). Each marker is
 * a real button named after the salon, so the map works with a keyboard and
 * a screen reader; the list stays the main way to choose.
 */
export default function SalonsMap({ center, salons, me }: Props) {
  const { t } = useTranslation('client');
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const summarize = useSalonSummary();
  // Rebuilt every 5 min at most: a new minute does not drop a focused marker.
  const now = useNow(5 * 60_000);

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
    return () => {
      instance.remove();
      map.current = null;
    };
    // Created once: the centre then moves with flyTo below.
  }, []);

  useEffect(() => {
    map.current?.flyTo({ center: [center.lng, center.lat] });
  }, [center.lat, center.lng]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return undefined;
    const markers = salons.map((salon) => {
      const button = document.createElement('button');
      button.type = 'button';
      // The marker says what the list card says (U-01, U-16).
      const summary = summarize(salon, now);
      button.className = `min-h-11 min-w-11 rounded-full border border-border px-3 font-semibold shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
        summary.badge
          ? BADGE_CLASSES[summary.badge.tone]
          : 'bg-surface text-text'
      }`;
      button.textContent = summary.badge?.text ?? salon.name;
      button.setAttribute(
        'aria-label',
        [
          salon.name,
          summary.badge?.text,
          summary.state,
          summary.slot,
          summary.freshness,
        ]
          .filter(Boolean)
          .join(', '),
      );
      button.addEventListener(
        'click',
        () => void navigate(`/salons/${salon.slug}`),
      );
      return new maplibregl.Marker({ element: button })
        .setLngLat([salon.longitude, salon.latitude])
        .addTo(instance);
    });
    return () => markers.forEach((m) => m.remove());
  }, [navigate, now, salons, summarize]);

  return (
    <div className="grid gap-2">
      <div
        aria-label={t('home.map.aria_label')}
        className="h-[60vh] min-h-72 w-full overflow-hidden rounded-xl border border-border"
        ref={box}
        role="region"
      />
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
