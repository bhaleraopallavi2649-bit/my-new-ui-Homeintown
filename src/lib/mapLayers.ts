// Pure helpers behind the Project-tab map's "Map details" layers sheet
// (components/MapLayersSheet.tsx). Kept free of React / react-native imports so
// Jest (testEnvironment: node) can cover them directly.
//
// Before this the MapView never set `mapType`, so it was always the plain
// road map with no way to switch to satellite, terrain or traffic.

export type MapBaseType = 'default' | 'satellite' | 'terrain';

// react-native-maps' own `mapType` values.
export type NativeMapType = 'standard' | 'satellite' | 'hybrid' | 'terrain';

// The map opens on satellite (with labels, i.e. hybrid) on user instruction.
// "Default" in the sheet still means the road map; it is just no longer the
// initial selection.
export const DEFAULT_MAP_BASE: MapBaseType = 'satellite';

export interface LatLng { latitude: number; longitude: number }

/**
 * Satellite imagery with labels is Google's `hybrid`; without labels it is
 * plain `satellite`. Road / terrain keep their type and hide labels through a
 * custom style instead (see LABELS_OFF_STYLE), because there is no
 * label-less variant of those map types.
 */
export function resolveMapType(base: MapBaseType, labels: boolean): NativeMapType {
  if (base === 'satellite') return labels ? 'hybrid' : 'satellite';
  if (base === 'terrain') return 'terrain';
  return 'standard';
}

// Google map style that hides every label. Only has a visible effect on the
// vector types (standard / terrain); satellite labels are handled by the type.
export const LABELS_OFF_STYLE = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const EARTH_RADIUS_M = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Total great-circle length of a path, in metres. 0 for fewer than 2 points. */
export function haversineMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

/** "850 m" under a kilometre, "1.24 km" from there on. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * react-native-maps has no Street View, so the panorama is handed to the
 * Google Maps app. `native` is its intent URI; `web` is the universal-link
 * fallback for when that app is missing.
 */
export function streetViewUrl(lat: number, lng: number): { native: string; web: string } {
  return {
    native: `google.streetview:cbll=${lat},${lng}`,
    web: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
  };
}
