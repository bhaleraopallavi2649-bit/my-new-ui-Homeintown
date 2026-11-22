import {
  resolveMapType, haversineMeters, formatDistance, streetViewUrl, DEFAULT_MAP_BASE,
} from '../mapLayers';

describe('resolveMapType', () => {
  it('maps satellite + labels to hybrid and satellite without labels to satellite', () => {
    expect(resolveMapType('satellite', true)).toBe('hybrid');
    expect(resolveMapType('satellite', false)).toBe('satellite');
  });
  it('keeps default and terrain regardless of labels', () => {
    expect(resolveMapType('default', true)).toBe('standard');
    expect(resolveMapType('default', false)).toBe('standard');
    expect(resolveMapType('terrain', true)).toBe('terrain');
    expect(resolveMapType('terrain', false)).toBe('terrain');
  });
  it('opens on satellite', () => {
    expect(DEFAULT_MAP_BASE).toBe('satellite');
  });
});

describe('haversineMeters', () => {
  const nagpur = { latitude: 21.1458, longitude: 79.0882 };
  const mumbai = { latitude: 19.076, longitude: 72.8777 };

  it('measures Nagpur → Mumbai at roughly 680-720 km', () => {
    const km = haversineMeters([nagpur, mumbai]) / 1000;
    expect(km).toBeGreaterThan(680);
    expect(km).toBeLessThan(720);
  });
  it('returns 0 for fewer than two points', () => {
    expect(haversineMeters([])).toBe(0);
    expect(haversineMeters([nagpur])).toBe(0);
  });
  it('sums every segment of a path', () => {
    const one = haversineMeters([nagpur, mumbai]);
    expect(haversineMeters([nagpur, mumbai, nagpur])).toBeCloseTo(one * 2, 3);
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(849.6)).toBe('850 m');
    expect(formatDistance(999.4)).toBe('999 m');
  });
  it('switches to km at 1000 m', () => {
    expect(formatDistance(1000)).toBe('1.00 km');
    expect(formatDistance(1240)).toBe('1.24 km');
  });
  it('treats bad input as zero', () => {
    expect(formatDistance(NaN)).toBe('0 m');
    expect(formatDistance(-5)).toBe('0 m');
  });
});

describe('streetViewUrl', () => {
  it('builds the app intent and the web fallback', () => {
    const u = streetViewUrl(21.1, 79.05);
    expect(u.native).toBe('google.streetview:cbll=21.1,79.05');
    expect(u.web).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=21.1,79.05');
  });
});
