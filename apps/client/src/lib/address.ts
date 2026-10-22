import type { AddressSuggestion } from '@zelate/ui';

interface GeoFeature {
  properties?: {
    label?: string;
    name?: string;
    postcode?: string;
    city?: string;
    citycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

/**
 * « Adresse ou ville » (F-C1): Géoplateforme geocoding (IGN, free, no key,
 * EU-hosted, TRD §3). Only the typed text leaves the browser.
 */
export async function searchPlaces(
  query: string,
): Promise<AddressSuggestion[]> {
  const url = new URL('https://data.geopf.fr/geocodage/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const response = await fetch(url);
  if (!response.ok) throw new Error('address search failed');
  const body = (await response.json()) as { features?: GeoFeature[] };
  return (body.features ?? []).flatMap((feature) => {
    const p = feature.properties;
    const c = feature.geometry?.coordinates;
    if (!p?.label || !c) return [];
    return [
      {
        label: p.label,
        addressLine: p.name ?? p.label,
        postalCode: p.postcode ?? '',
        city: p.city ?? '',
        cityCode: p.citycode ?? '',
        longitude: c[0],
        latitude: c[1],
      },
    ];
  });
}
