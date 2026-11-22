// D3: getSession reports network/5xx as transient (token kept) and only a real
// answer as unauthenticated.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
const mockTokenGet = jest.fn(async (): Promise<string | null> => 'tkn');
const mockTokenClear = jest.fn(async () => {});
jest.mock('../storage', () => ({ tokenStorage: { get: () => mockTokenGet(), set: jest.fn(), clear: () => mockTokenClear() } }));

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

describe('authApi.getSession offline handling (D3)', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    mockTokenGet.mockImplementation(async () => 'tkn');
    mockTokenClear.mockClear();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('network error → transient:true and token kept (clear not called)', async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError('Network request failed'); });
    const s = await api.authApi.getSession();
    expect(s).toMatchObject({ authenticated: false, user: null, transient: true });
    expect(mockTokenClear).not.toHaveBeenCalled();
  });

  it('/auth/session 503 + /users/me 503 → transient', async () => {
    fetchMock.mockImplementation(async () => response(503, {}));
    const s = await api.authApi.getSession();
    expect(s.transient).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockTokenClear).not.toHaveBeenCalled();
  });

  it('/auth/session 503 + /users/me 200 → authenticated (fallback kept)', async () => {
    fetchMock
      .mockImplementationOnce(async () => response(503, {}))
      .mockImplementationOnce(async () => response(200, { _id: 'u1', name: 'A', role: 'agent' }));
    const s = await api.authApi.getSession();
    expect(s.authenticated).toBe(true);
    expect(s.user?.id).toBe('u1');
    expect(s.transient).toBeUndefined();
  });

  it('/auth/session 401 + /users/me 401 → unauthenticated, not transient', async () => {
    fetchMock.mockImplementation(async () => response(401, { error: 'Not authorized' }));
    const s = await api.authApi.getSession();
    expect(s).toEqual({ authenticated: false, user: null });
  });

  it('200 { authenticated:false } → unauthenticated', async () => {
    fetchMock.mockImplementation(async () => response(200, { authenticated: false }));
    const s = await api.authApi.getSession();
    expect(s).toEqual({ authenticated: false, user: null });
  });

  it('429 → rateLimited (unchanged)', async () => {
    fetchMock.mockImplementation(async () => response(429, {}));
    const s = await api.authApi.getSession();
    expect(s.rateLimited).toBe(true);
    expect(s.transient).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no token → no fetch', async () => {
    mockTokenGet.mockImplementation(async () => null);
    const s = await api.authApi.getSession();
    expect(s).toEqual({ authenticated: false, user: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes an abort signal so a hanging request is bounded', async () => {
    fetchMock.mockImplementation(async () => response(200, { authenticated: true, user: { _id: 'u1' } }));
    await api.authApi.getSession();
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});
