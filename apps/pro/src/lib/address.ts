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

/** Géoplateforme address search (free, no key, EU-hosted). */
export async function searchAddresses(
  query: string,
): Promise<AddressSuggestion[]> {
  const url = new URL('https://data.geopf.fr/geocodage/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('type', 'housenumber');
  const response = await fetch(url);
  if (!response.ok) throw new Error('address search failed');
  const body = (await response.json()) as { features?: GeoFeature[] };
  return (body.features ?? []).flatMap((feature) => {
    const p = feature.properties;
    const c = feature.geometry?.coordinates;
    if (!p?.label || !p.name || !p.postcode || !p.city || !c) return [];
    return [
      {
        label: p.label,
        addressLine: p.name,
        postalCode: p.postcode,
        city: p.city,
        cityCode: p.citycode ?? '',
        longitude: c[0],
        latitude: c[1],
      },
    ];
  });
}
