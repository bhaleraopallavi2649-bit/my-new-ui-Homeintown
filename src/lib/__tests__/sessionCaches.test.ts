// P6 logout cleanup: clearSessionCaches (called by authContext.logout) drops the
// module-level response caches, so the next account on the device refetches
// instead of being served the previous account's lists for up to 60 s.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function okResponse(body: any) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

describe('clearSessionCaches', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/lead-matching/leads')) return okResponse({ leads: [{ _id: 'l1' }], pagination: {} });
      return okResponse([{ _id: 'p1' }]);
    });
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  // authHeaders() is awaited before fetch, so let queued microtasks run.
  const flush = () => new Promise((r) => setImmediate(r));
  const calls = (part: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(part)).length;

  it('without a clear, the 60 s caches serve repeat calls (baseline)', async () => {
    await api.leadMatchingApi.getLeads({ mineOnly: true });
    await api.leadMatchingApi.getLeads({ mineOnly: true });
    await api.fetchPublicProjectsRaw();
    await api.fetchPublicProjectsRaw();
    expect(calls('/lead-matching/leads')).toBe(1);
    expect(calls('/public/projects')).toBe(1);
  });

  it('after a clear, My Posts leads and public projects are fetched again', async () => {
    await api.leadMatchingApi.getLeads({ mineOnly: true });
    await api.fetchPublicProjectsRaw();
    api.clearSessionCaches();
    await api.leadMatchingApi.getLeads({ mineOnly: true });
    await api.fetchPublicProjectsRaw();
    expect(calls('/lead-matching/leads')).toBe(2);
    expect(calls('/public/projects')).toBe(2);
  });

  // Phase 9: a request already in flight when the caches are cleared (logout,
  // or a lead/project write) must not refill them when it lands late.
  it('a leads / match-counts request in flight during a clear does not refill the cache', async () => {
    const pending: Array<() => void> = [];
    fetchMock.mockImplementation((url: string) => new Promise((resolve) => {
      const body = String(url).includes('/match-counts') ? { counts: { p1: 3 } } : { leads: [{ _id: 'old' }], pagination: {} };
      pending.push(() => resolve(okResponse(body)));
    }));
    const oldLeads = api.leadMatchingApi.getLeads({ mineOnly: true });
    const oldCounts = api.projectsApiExtended.matchCounts(['p1']);
    api.clearSessionCaches();
    await flush();
    pending.splice(0).forEach((r) => r());
    await oldLeads;
    await oldCounts;

    fetchMock.mockImplementation(async (url: string) => (String(url).includes('/match-counts')
      ? okResponse({ counts: { p1: 0 } })
      : okResponse({ leads: [{ _id: 'new' }], pagination: {} })));
    const leads = await api.leadMatchingApi.getLeads({ mineOnly: true });
    const counts = await api.projectsApiExtended.matchCounts(['p1']);
    expect(leads.leads[0]._id).toBe('new');
    expect(counts).toEqual({ p1: 0 });
    expect(calls('/lead-matching/leads')).toBe(2);
    expect(calls('/match-counts')).toBe(2);
  });

  it('a stale request settling does not drop the newer in-flight entry (no duplicate fetch)', async () => {
    const pending: Array<() => void> = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => {
      pending.push(() => resolve(okResponse({ leads: [], pagination: {} })));
    }));
    const stale = api.leadMatchingApi.getLeads({ mineOnly: true });
    api.invalidateLeadsCache();
    const fresh = api.leadMatchingApi.getLeads({ mineOnly: true });
    await flush();
    pending[0]();
    await stale;
    // Joins `fresh` instead of starting a third request.
    const joiner = api.leadMatchingApi.getLeads({ mineOnly: true });
    pending[1]();
    await fresh;
    await joiner;
    expect(calls('/lead-matching/leads')).toBe(2);
  });
});
