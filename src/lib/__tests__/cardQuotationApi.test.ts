// cardApi / quotationsApi against the HIT_Backend be5a995 contracts
// (cardController, quotationController). The backend is not deployed yet, so
// these pin the request shapes the screens rely on.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

describe('cardApi / quotationsApi', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  const call = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i];
    return { url: String(url), method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : undefined, headers: init?.headers };
  };

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, {}));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('cardApi.getMine → GET /users/me/card with Bearer, unwraps card', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, { card: { code: 'rahul-sharma-k7m2q', published: false } }));
    const card = await api.cardApi.getMine();
    expect(call().url).toMatch(/\/users\/me\/card$/);
    expect(call().method).toBe('GET');
    expect(call().headers.Authorization).toBe('Bearer tkn');
    expect(card.code).toBe('rahul-sharma-k7m2q');
  });

  it('cardApi.update sends only the given keys', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, { card: { published: true } }));
    const card = await api.cardApi.update({ published: true, designation: 'Sales head' });
    expect(call().url).toMatch(/\/users\/me\/card$/);
    expect(call().method).toBe('PATCH');
    expect(call().body).toEqual({ published: true, designation: 'Sales head' });
    expect(card.published).toBe(true);
  });

  it('readiness builds the query and encodes the project id', async () => {
    await api.quotationsApi.readiness('p 1', { unitId: 'u1', bhk: '2 BHK' });
    expect(call().url).toMatch(/\/projects\/p%201\/quotation-readiness\?unitId=u1&bhk=2\+BHK$/);
    await api.quotationsApi.readiness('p1');
    expect(call(1).url).toMatch(/\/projects\/p1\/quotation-readiness$/);
  });

  it('updateSettings → PUT quotation-settings with the patch', async () => {
    await api.quotationsApi.updateSettings('p1', { gstPercent: 5 });
    expect(call().url).toMatch(/\/projects\/p1\/quotation-settings$/);
    expect(call().method).toBe('PUT');
    expect(call().body).toEqual({ gstPercent: 5 });
  });

  it('requestSettings → POST { missing }; a 429 keeps .status', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, { sent: true, notified: 1 }));
    expect(await api.quotationsApi.requestSettings('p1', ['ratePerSqFt'])).toEqual({ sent: true, notified: 1 });
    expect(call().url).toMatch(/\/projects\/p1\/quotation-settings\/request$/);
    expect(call().method).toBe('POST');
    expect(call().body).toEqual({ missing: ['ratePerSqFt'] });

    fetchMock.mockImplementationOnce(async () => response(429, { message: 'Request already sent. You can ask again after an hour.' }));
    await expect(api.quotationsApi.requestSettings('p1', ['ratePerSqFt'])).rejects.toMatchObject({ status: 429 });
  });

  it('create → POST /quotations, unwraps { quotation } and maps _id → id', async () => {
    fetchMock.mockImplementationOnce(async () => response(201, { quotation: { _id: 'q1', project: 'p1', number: 'HIT-Q-2026-0001', status: 'sent' } }));
    const q = await api.quotationsApi.create({ projectId: 'p1', unitId: 'u1', buyer: { name: 'Amit' } });
    expect(call().url).toMatch(/\/quotations$/);
    expect(call().method).toBe('POST');
    expect(call().body).toEqual({ projectId: 'p1', unitId: 'u1', buyer: { name: 'Amit' } });
    expect(q).toMatchObject({ id: 'q1', project: 'p1', number: 'HIT-Q-2026-0001', effectiveStatus: 'sent' });
  });

  it('create 422 rejects with ApiError keeping .data.missing', async () => {
    fetchMock.mockImplementationOnce(async () => response(422, { message: 'Some required details are missing', missing: ['ratePerSqFt'] }));
    const err: any = await api.quotationsApi.create({ projectId: 'p1', buyer: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(api.ApiError);
    expect(err.status).toBe(422);
    expect(err.data.missing).toEqual(['ratePerSqFt']);
  });

  it('list builds ?status=expired&page=2 and returns hasMore', async () => {
    fetchMock.mockImplementationOnce(async () => response(200, {
      quotations: [{ _id: 'q1', number: 'HIT-Q-2026-0001', project: 'p1', totals: { grandTotal: 100 }, status: 'sent', effectiveStatus: 'expired' }],
      page: 2,
      hasMore: true,
    }));
    const out = await api.quotationsApi.list({ status: 'expired', page: 2 });
    expect(call().url).toMatch(/\/quotations\?status=expired&page=2$/);
    expect(out.hasMore).toBe(true);
    expect(out.page).toBe(2);
    expect(out.quotations[0]).toMatchObject({ id: 'q1', project: 'p1', effectiveStatus: 'expired', totals: { grandTotal: 100 } });
  });

  it('get → GET /quotations/:id; updateStatus → PATCH /status', async () => {
    fetchMock.mockImplementation(async () => response(200, { quotation: { id: 'q1', project: 'p1', status: 'accepted' } }));
    expect((await api.quotationsApi.get('q1')).id).toBe('q1');
    expect(call().url).toMatch(/\/quotations\/q1$/);
    expect(call().method).toBe('GET');
    const q = await api.quotationsApi.updateStatus('q1', 'accepted');
    expect(call(1).url).toMatch(/\/quotations\/q1\/status$/);
    expect(call(1).method).toBe('PATCH');
    expect(call(1).body).toEqual({ status: 'accepted' });
    expect(q.effectiveStatus).toBe('accepted');
  });
});
