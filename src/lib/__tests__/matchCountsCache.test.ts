// Locks the request-dedup behaviour P2-05 relies on: projectsApiExtended
// .matchCounts keys its 60 s cache on the sorted id list, so the same id set in
// a different order must not hit the network again.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

function okResponse(body: any) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

describe('projectsApiExtended.matchCounts cache', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => okResponse({ counts: { a: 1, b: 2 } }));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('serves the same id set in a different order from cache', async () => {
    const first = await api.projectsApiExtended.matchCounts(['a', 'b']);
    const second = await api.projectsApiExtended.matchCounts(['b', 'a']);
    expect(first).toEqual({ a: 1, b: 2 });
    expect(second).toEqual({ a: 1, b: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/lead-matching\/match-counts$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });

  it('shares one in-flight request between concurrent identical calls', async () => {
    const [x, y] = await Promise.all([
      api.projectsApiExtended.matchCounts(['a', 'b']),
      api.projectsApiExtended.matchCounts(['b', 'a']),
    ]);
    expect(x).toEqual(y);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a different id set is a separate request', async () => {
    await api.projectsApiExtended.matchCounts(['a', 'b']);
    await api.projectsApiExtended.matchCounts(['a']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
