// Phase 3: account A → logout → account B on one device, end to end through the
// real api.ts, storage.ts and sessionResolve.ts (only SecureStore, AsyncStorage
// and fetch are faked). Replays authContext.logout's steps (authApi.logout →
// clearSessionCaches) and its sign-in path (commitAuthenticatedUser with the
// real storageOwner.ensure). The D10 session-expired path calls that same
// logout, so it is covered by the same sequence.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => (mockSecure.has(k) ? mockSecure.get(k)! : null),
  setItemAsync: async (k: string, v: string) => { mockSecure.set(k, v); },
  deleteItemAsync: async (k: string) => { mockSecure.delete(k); },
}));
const mockAsync = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => (mockAsync.has(k) ? mockAsync.get(k)! : null),
    setItem: async (k: string, v: string) => { mockAsync.set(k, v); },
    removeItem: async (k: string) => { mockAsync.delete(k); },
  },
}));

export {};

const USERS: Record<string, { token: string; user: any; leads: any[] }> = {
  '9000000001': { token: 'tok-A', user: { _id: 'A', name: 'Account A', role: 'agent' }, leads: [{ _id: 'lead-of-A' }] },
  '9000000002': { token: 'tok-B', user: { _id: 'B', name: 'Account B', role: 'agent' }, leads: [{ _id: 'lead-of-B' }] },
};
const AI_KEYS = ['hit_ai_post_draft', 'hit_ai_posted_list', 'hit_ai_chat_cleared_before_id', 'hit_ai_disappear_ms'];

function res(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

describe('account A → logout → account B (no cross-account leak)', () => {
  let api: typeof import('../api');
  let storage: typeof import('../storage');
  let resolve: typeof import('../sessionResolve');
  let fetchMock: jest.Mock;
  const bearer = (i: number) => fetchMock.mock.calls[i][1]?.headers?.Authorization;

  beforeEach(() => {
    jest.resetModules();
    mockSecure.clear();
    mockAsync.clear();
    fetchMock = jest.fn(async (url: string, init: any) => {
      const u = String(url);
      if (u.endsWith('/auth/login')) {
        const acct = USERS[JSON.parse(init.body).phone];
        return res(200, { user: acct.user, token: acct.token });
      }
      if (u.endsWith('/auth/logout')) return res(200, {});
      const auth = init?.headers?.Authorization || '';
      const acct = Object.values(USERS).find((x) => auth === `Bearer ${x.token}`);
      if (!acct) return res(401, { error: 'Not authorized - No token provided' });
      if (u.includes('/lead-matching/leads')) return res(200, { leads: acct.leads, pagination: {} });
      return res(200, []);
    });
    (global as any).fetch = fetchMock;
    api = require('../api');
    storage = require('../storage');
    resolve = require('../sessionResolve');
  });

  async function signIn(phone: string) {
    const { user } = await api.authApi.login(phone, '1234');
    let keysAtCommit: (string | null)[] = [];
    await resolve.commitAuthenticatedUser(user, storage.storageOwner.ensure, () => {
      keysAtCommit = AI_KEYS.map((k) => (mockAsync.has(k) ? mockAsync.get(k)! : null));
    });
    return { user, keysAtCommit };
  }
  // authContext.logout, minus the React state and the socket.
  async function logout() {
    await api.authApi.logout();
    api.clearSessionCaches();
  }

  it('B never sees A’s token, cached leads or AI Assist keys', async () => {
    const a = await signIn('9000000001');
    expect(a.user.id).toBe('A');
    const leadsA = await api.leadMatchingApi.getLeads({ mineOnly: true });
    expect(leadsA.leads.map((l: any) => l._id)).toEqual(['lead-of-A']);
    for (const k of AI_KEYS) mockAsync.set(k, 'A-private');

    await logout();
    expect(await storage.tokenStorage.get()).toBeNull();

    const b = await signIn('9000000002');
    expect(b.user.id).toBe('B');
    // A's per-user keys were gone BEFORE B was committed (dashboard mount).
    expect(b.keysAtCommit).toEqual([null, null, null, null]);
    expect(mockAsync.get('hit_ai_storage_owner')).toBe('B');

    const before = fetchMock.mock.calls.length;
    const leadsB = await api.leadMatchingApi.getLeads({ mineOnly: true });
    // Refetched (cache was cleared), with B's token, returning only B's data.
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(bearer(before)).toBe('Bearer tok-B');
    expect(leadsB.leads.map((l: any) => l._id)).toEqual(['lead-of-B']);
    expect(JSON.stringify(leadsB)).not.toContain('lead-of-A');
  });

  it('without the logout cache clear, B would be served A’s cached leads (guards the guard)', async () => {
    await signIn('9000000001');
    await api.leadMatchingApi.getLeads({ mineOnly: true });
    await api.authApi.logout(); // token cleared but caches NOT cleared
    await signIn('9000000002');
    const leads = await api.leadMatchingApi.getLeads({ mineOnly: true });
    expect(leads.leads.map((l: any) => l._id)).toEqual(['lead-of-A']);
  });

  it('a request after logout carries no token and is refused (401), never A’s session', async () => {
    await signIn('9000000001');
    await logout();
    const handler = jest.fn();
    api.setSessionExpiredHandler(handler);
    await expect(api.leadMatchingApi.getLeads({ mineOnly: true })).rejects.toMatchObject({ status: 401 });
    const last = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(last[1].headers.Authorization).toBeUndefined();
    // authContext's handler ignores 401s while nobody is signed in; here the
    // raw hook still fires, which is why that userIdRef gate exists.
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
