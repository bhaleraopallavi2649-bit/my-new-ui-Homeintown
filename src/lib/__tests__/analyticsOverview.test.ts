// GET /analytics/overview answers rows shaped by HIT_Backend AnalyticsService
// (`{ id, name, totalVisits, uniqueLeads, totalTimeSpent, ctaClicks, calls,
// whatsapp, forms }`, same keys at 1da3625 and 44a1bfc and what HIT_Frontend's
// analytics page reads). The mobile screen read projectId / projectName /
// totalCalls / totalWhatsApp, which the backend never sends, so every chart
// label was "?", every "All Projects" row had no name, and Calls / WA were 0.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

// Realistic live rows: `name` from project.projectName || project.name, `id`
// from mapProject's `{ id, ...rest }` (no `_id`).
const backendRows = [
  { id: 'p1', name: 'Balaji Heights Phase 2', totalVisits: 84, uniqueLeads: 11, totalTimeSpent: 3200, ctaClicks: 5, calls: 3, whatsapp: 2, forms: 0 },
  { id: 'p2', name: 'Green Valley', totalVisits: 27, uniqueLeads: 0, totalTimeSpent: 400, ctaClicks: 0, calls: 0, whatsapp: 0, forms: 0 },
];

describe('analyticsApi.overview maps the backend overview row shape', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, backendRows));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('calls GET /analytics/overview with Bearer', async () => {
    await api.analyticsApi.overview();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/analytics\/overview$/);
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });

  it('reads name / id / calls / whatsapp / forms from the backend keys', async () => {
    const rows = await api.analyticsApi.overview();
    expect(rows.map(r => r.projectName)).toEqual(['Balaji Heights Phase 2', 'Green Valley']);
    expect(rows.map(r => r.projectId)).toEqual(['p1', 'p2']);
    expect(rows[0]).toMatchObject({ totalVisits: 84, uniqueLeads: 11, totalTimeSpent: 3200, totalCalls: 3, totalWhatsApp: 2, totalForms: 0 });
  });

  it('still accepts the projectName / projectId / total* keys if a server ever sends them', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, [
      { _id: 'p9', projectName: 'Legacy', totalVisits: 1, uniqueLeads: 1, totalCalls: 4, totalWhatsApp: 5, totalForms: 6 },
    ]));
    const [row] = await api.analyticsApi.overview();
    expect(row).toMatchObject({ projectId: 'p9', projectName: 'Legacy', totalCalls: 4, totalWhatsApp: 5, totalForms: 6 });
  });

  it('non-array body or junk entries do not crash the screen', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, { message: 'x' }));
    expect(await api.analyticsApi.overview()).toEqual([]);
    fetchMock.mockImplementationOnce(async () => response(200, [null, 3, backendRows[1]]));
    const rows = await api.analyticsApi.overview();
    expect(rows).toHaveLength(1);
    expect(rows[0].projectName).toBe('Green Valley');
  });
});
