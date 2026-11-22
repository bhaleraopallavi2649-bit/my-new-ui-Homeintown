// D7: Nominatim requests identify the app.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

import { nominatimUserAgent, placeNameFromNominatim, reverseGeocodePlaceName } from '../geocode';

describe('geocode (D7)', () => {
  it('User-Agent is HomeInTown-Mobile/1.0.0 (in.homeintown.mobile)', () => {
    expect(nominatimUserAgent('1.0.0')).toBe('HomeInTown-Mobile/1.0.0 (in.homeintown.mobile)');
  });

  it('missing version → unknown, never an email', () => {
    const ua = nominatimUserAgent(undefined);
    expect(ua).toBe('HomeInTown-Mobile/unknown (in.homeintown.mobile)');
    expect(ua).not.toMatch(/@/);
  });

  it('reverseGeocodePlaceName sends the User-Agent header to nominatim reverse', async () => {
    const f = jest.fn(async () => ({ json: async () => ({ display_name: 'A, B, C, D, E' }) }));
    const name = await reverseGeocodePlaceName(18.5, 73.8, f as any);
    const [url, init] = (f.mock.calls[0] as any[]);
    expect(String(url)).toBe('https://nominatim.openstreetmap.org/reverse?lat=18.5&lon=73.8&format=json');
    expect(init.headers['User-Agent']).toBe('HomeInTown-Mobile/1.0.0 (in.homeintown.mobile)');
    expect(name).toBe('A,  B,  C');
  });

  it('placeNameFromNominatim keeps the first three parts', () => {
    expect(placeNameFromNominatim({ display_name: 'X,Y,Z,W' })).toBe('X, Y, Z');
  });

  it('missing display_name → null', () => {
    expect(placeNameFromNominatim({})).toBeNull();
    expect(placeNameFromNominatim(null)).toBeNull();
  });
});
