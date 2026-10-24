import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@zelate/ui';
import type { SalonResult } from '../lib/client-api';
import { useNow } from '../lib/live';
import { estimateWidth, groupKey, groupOverlapping } from '../lib/map-groups';
import { BADGE_CLASSES, useSalonSummary } from '../lib/salon-summary';

/** OpenFreeMap: free tiles, no key, not openstreetmap.org's own servers (TRD §3). */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** Beyond this zoom, salons still grouped are too close to split: listed instead. */
const MAX_SPLIT_ZOOM = 17.9;

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
  members: SalonResult[];
}

type Selection =
  { kind: 'salon'; id: string } | { kind: 'group'; ids: string[] };

const PILL =
  'min-h-11 min-w-11 rounded-full border border-border-strong px-3 font-semibold shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

/** Our classes only: MapLibre's own (`maplibregl-marker…`) place the marker. */
function setPillClasses(element: HTMLElement, classes: string) {
  const own = [...element.classList].filter((c) => c.startsWith('maplibregl-'));
  element.className = [...own, PILL, classes].join(' ');
}

/**
 * F-C1 map, loaded only when the « Carte » tab opens (TRD §3). Markers are
 * compact pills (wait, « Complet », « Fermé »); pills that would overlap
 * become one « 3 salons » pill that zooms in when touched. Touching a salon
 * shows its card under the map. Every marker is a real button, in the
 * list's order, so the map works with a keyboard and a screen reader; the
 * list stays the main way to choose.
 */
export default function SalonsMap({ center, salons, me }: Props) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const cardId = useId();
  const headingId = useId();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const shown = useRef(new Map<string, Shown>());
  const summarize = useSalonSummary();
  // Rebuilt every 5 min at most: a new minute does not drop a focused marker.
  const now = useNow(5 * 60_000);
  const [moves, setMoves] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
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

  // A salon gone from the list (filter, new search) closes its card; the
  // focus, if it was in the card, goes to the map rather than nowhere.
  useEffect(() => {
    if (!selected) return;
    const ids = selected.kind === 'salon' ? [selected.id] : selected.ids;
    if (ids.every((id) => salons.some((s) => s.id === id))) return;
    if (card.current?.contains(document.activeElement)) {
      map.current?.getCanvas().focus({ preventScroll: true });
    }
    setSelected(null);
  }, [salons, selected]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const focusedIds = [...shown.current.values()].find(
      (e) => e.element === document.activeElement,
    )?.ids;
    const byId = new Map(salons.map((s) => [s.id, s]));
    const texts = new Map(
      salons.map((s) => [s.id, summarize(s, now).badge?.text ?? s.name]),
    );
    const groups = groupOverlapping(
      salons.map((s) => {
        const p = instance.project([s.longitude, s.latitude]);
        return {
          id: s.id,
          x: p.x,
          y: p.y,
          width: estimateWidth(texts.get(s.id)!),
        };
      }),
    );
    const container = instance.getCanvasContainer();
    const keep = new Set<string>();
    const order: HTMLButtonElement[] = [];
    for (const ids of groups) {
      const key = groupKey(ids);
      keep.add(key);
      const members = ids.map((id) => byId.get(id)!);
      // A group stands on its nearest salon, never between two pills.
      const anchor: [number, number] = [
        members[0]!.longitude,
        members[0]!.latitude,
      ];
      let entry = shown.current.get(key);
      if (!entry) {
        const element = document.createElement('button');
        element.type = 'button';
        const created: Shown = {
          marker: new maplibregl.Marker({ element }).setLngLat(anchor),
          element,
          ids,
          members,
        };
        element.addEventListener('click', () => {
          const group = created.members;
          if (group.length === 1) {
            setSelected({ kind: 'salon', id: group[0]!.id });
            return;
          }
          const bounds = new maplibregl.LngLatBounds();
          group.forEach((s) => bounds.extend([s.longitude, s.latitude]));
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const samePoint = sw.lng === ne.lng && sw.lat === ne.lat;
          // Too close to ever split (same arcade): list them instead.
          if (samePoint || instance.getZoom() >= MAX_SPLIT_ZOOM) {
            setSelected({ kind: 'group', ids: group.map((s) => s.id) });
            return;
          }
          instance.fitBounds(bounds, { padding: 80, maxZoom: 18 });
        });
        created.marker.addTo(instance);
        shown.current.set(key, created);
        entry = created;
      } else {
        entry.marker.setLngLat(anchor);
        entry.members = members;
      }
      const { element } = entry;
      if (ids.length === 1) {
        // The marker says what the list card says (U-01, U-16).
        const salon = members[0]!;
        const summary = summarize(salon, now);
        setPillClasses(
          element,
          summary.badge
            ? BADGE_CLASSES[summary.badge.tone]
            : 'bg-surface text-text',
        );
        element.textContent = texts.get(salon.id)!;
        element.setAttribute(
          'aria-label',
          [salon.name, summary.badge?.text, summary.state, summary.slot]
            .filter(Boolean)
            .join(', '),
        );
        element.setAttribute('aria-controls', cardId);
      } else {
        setPillClasses(element, 'bg-surface text-text');
        element.textContent = t('home.map.group', { count: ids.length });
        element.setAttribute(
          'aria-label',
          t('home.map.group_aria', {
            count: ids.length,
            names: members.map((s) => s.name).join(', '),
          }),
        );
        element.removeAttribute('aria-controls');
      }
      order.push(element);
    }
    for (const [key, entry] of shown.current) {
      if (!keep.has(key)) {
        entry.marker.remove();
        shown.current.delete(key);
      }
    }
    // Tab order = list order (nearest first), after any regrouping.
    const current = [...container.querySelectorAll('button.maplibregl-marker')];
    if (current.some((el, i) => el !== order[i])) {
      order.forEach((el) => container.appendChild(el));
    }
    // A focused marker merged, split or moved: the focus follows its salon.
    if (focusedIds && document.activeElement === document.body) {
      [...shown.current.values()]
        .find((e) => e.ids.includes(focusedIds[0]!))
        ?.element.focus({ preventScroll: true });
    }
  }, [cardId, moves, now, salons, summarize, t]);

  // Only the open marker says so; no regrouping for that.
  useEffect(() => {
    for (const entry of shown.current.values()) {
      if (entry.ids.length !== 1) continue;
      entry.element.setAttribute(
        'aria-expanded',
        String(selected?.kind === 'salon' && selected.id === entry.ids[0]),
      );
    }
  }, [moves, selected]);

  // The card takes the focus when it opens (WCAG 2.4.3).
  useEffect(() => {
    if (selected) cardHeading.current?.focus();
  }, [selected]);

  const close = useCallback(() => {
    const id = selected?.kind === 'salon' ? selected.id : selected?.ids[0];
    setSelected(null);
    // Back to the salon's marker, or its group if the map moved since.
    for (const entry of shown.current.values()) {
      if (id && entry.ids.includes(id)) {
        entry.element.focus({ preventScroll: true });
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

  const salon =
    selected?.kind === 'salon'
      ? salons.find((s) => s.id === selected.id)
      : undefined;
  const summary = salon ? summarize(salon, now) : null;
  const group =
    selected?.kind === 'group'
      ? selected.ids
          .map((id) => salons.find((s) => s.id === id))
          .filter((s): s is SalonResult => s !== undefined)
      : [];

  return (
    <div className="grid gap-3">
      <div
        aria-label={t('home.map.aria_label')}
        className="h-[60vh] min-h-72 w-full overflow-hidden rounded-xl border border-border"
        ref={box}
        role="region"
      />
      {/* Under the map, never over it: no hidden marker, no clipped card. */}
      {selected ? (
        <section
          aria-labelledby={headingId}
          className="grid gap-2 rounded-xl border border-border bg-surface p-4 shadow-md"
          id={cardId}
          ref={card}
        >
          {salon && summary ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3
                  className="text-h3 font-semibold"
                  id={headingId}
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
                {[salon.address_line, summary.state]
                  .filter(Boolean)
                  .join(' · ')}
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
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-text-on-primary"
                to={`/salons/${salon.slug}`}
              >
                {t('home.map.view_salon')}
              </Link>
            </>
          ) : (
            <>
              <h3
                className="text-h3 font-semibold"
                id={headingId}
                ref={cardHeading}
                tabIndex={-1}
              >
                {t('home.map.group', { count: group.length })}
              </h3>
              <ul className="grid gap-1">
                {group.map((s) => {
                  const line = summarize(s, now);
                  return (
                    <li key={s.id}>
                      <Link
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 font-semibold text-link underline"
                        to={`/salons/${s.slug}`}
                      >
                        <span>
                          {t('home.map.open_salon', { salon_name: s.name })}
                        </span>
                        {line.badge ? (
                          <span
                            className={`shrink-0 rounded-full px-3 py-0.5 tabular-nums no-underline ${BADGE_CLASSES[line.badge.tone]}`}
                          >
                            {line.badge.text}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <Button onClick={close} variant="secondary">
            {tCommon('actions.close')}
          </Button>
        </section>
      ) : null}
      {me ? (
        <Button
          onClick={() =>
            map.current?.flyTo({ center: [me.lng, me.lat], zoom: 14 })
          }
          variant="secondary"
        >
          {t('home.map.locate_me')}
        </Button>
      ) : null}
    </div>
  );
}
