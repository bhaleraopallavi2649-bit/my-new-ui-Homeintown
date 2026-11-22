// P7-07: fetchPublicProjectsRaw dedupe / TTL / invalidation races.
// Previously a request in flight during invalidatePublicProjects() still wrote
// the cache when it landed (stale list served as fresh for 60 s), and a force
// call's `finally` cleared another request's in-flight slot.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function okResponse(body: any) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

type Deferred = { resolve: (v: any) => void; promise: Promise<any> };
function deferred(): Deferred {
  let resolve!: (v: any) => void;
  const promise = new Promise((r) => { resolve = r; });
  return { resolve, promise };
}

// Lets the async IIFE inside fetchPublicProjectsRaw reach its fetch() call.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('fetchPublicProjectsRaw', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  let pending: Deferred[];

  beforeEach(() => {
    jest.resetModules();
    pending = [];
    fetchMock = jest.fn(() => {
      const d = deferred();
      pending.push(d);
      return d.promise;
    });
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('(a) two concurrent callers share one request', async () => {
    const a = api.fetchPublicProjectsRaw();
    const b = api.fetchPublicProjectsRaw();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    pending[0].resolve(okResponse([{ _id: 'p1' }]));
    await expect(a).resolves.toEqual([{ _id: 'p1' }]);
    await expect(b).resolves.toEqual([{ _id: 'p1' }]);
  });

  it('(b) invalidate during flight: the late response is not cached', async () => {
    const a = api.fetchPublicProjectsRaw();
    await flush();
    api.invalidatePublicProjects();
    pending[0].resolve(okResponse([{ _id: 'old' }]));
    await a; // the caller that asked still gets its data
    const next = api.fetchPublicProjectsRaw();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    pending[1].resolve(okResponse([{ _id: 'new' }]));
    await expect(next).resolves.toEqual([{ _id: 'new' }]);
  });

  it('(c) an older request settling does not clear a newer force request in flight', async () => {
    const older = api.fetchPublicProjectsRaw(true);
    await flush();
    api.invalidatePublicProjects(); // keeps the cache cold for the joiner below
    const forced = api.fetchPublicProjectsRaw(true);
    await flush();
    pending[0].resolve(okResponse([{ _id: 'old' }]));
    await older; // its finally must leave `forced`'s slot alone
    const joiner = api.fetchPublicProjectsRaw();
    await flush();
    // Old code: the slot was nulled, so the joiner started a third fetch.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    pending[1].resolve(okResponse([{ _id: 'new' }]));
    await expect(joiner).resolves.toEqual([{ _id: 'new' }]);
    await expect(forced).resolves.toEqual([{ _id: 'new' }]);
  });

  it('(d) within the TTL a repeat call is served from cache', async () => {
    const a = api.fetchPublicProjectsRaw();
    await flush();
    pending[0].resolve(okResponse([{ _id: 'p1' }]));
    await a;
    await expect(api.fetchPublicProjectsRaw()).resolves.toEqual([{ _id: 'p1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
