// D7: reverse geocoding for Field check-in / meeting log via OSM Nominatim.
//
// Nominatim's usage policy requires an identifying User-Agent. PREVIOUS
// BEHAVIOUR: field.tsx called it with a bare fetch (two copies), so requests
// went out with the platform default agent and risked being blocked. No email
// is included because the app config has no support contact to point at.
import Constants from 'expo-constants';

export function nominatimUserAgent(version?: string | null): string {
  return `HomeInTown-Mobile/${version || 'unknown'} (in.homeintown.mobile)`;
}

// The existing display rule: first three comma parts of display_name.
export function placeNameFromNominatim(data: any): string | null {
  return data?.display_name?.split(',')?.slice(0, 3)?.join(', ') || null;
}

export async function reverseGeocodePlaceName(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchImpl(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
    headers: {
      'User-Agent': nominatimUserAgent(Constants.expoConfig?.version),
      Accept: 'application/json',
    },
  });
  return placeNameFromNominatim(await res.json());
}
