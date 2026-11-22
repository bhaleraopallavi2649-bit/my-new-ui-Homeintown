// P4-02: ChatSession.unreadCount is a Mongoose Map on the backend and arrives as
// `{ "<userId>": n }`. The old `Number(obj)` was NaN, so no badge ever showed.
// P4-01: chatApi.markRead hit a route that does not exist and was removed.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

// Module scope, so this file's helpers do not collide with other test scripts' globals under tsc.
export {};

function okResponse(body: any) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

describe('transformChatSession unreadCount', () => {
  let api: typeof import('../api');
  beforeEach(() => {
    jest.resetModules();
    api = require('../api');
  });

  it('reads the per-user entry of the map', () => {
    expect(api.transformChatSession({ _id: 's1', unreadCount: { u1: 3 } }, 'u1').unreadCount).toBe(3);
  });
  it('accepts a plain number', () => {
    expect(api.transformChatSession({ _id: 's1', unreadCount: 5 }).unreadCount).toBe(5);
  });
  it('missing field → 0', () => {
    expect(api.transformChatSession({ _id: 's1' }, 'u1').unreadCount).toBe(0);
  });
  it('map without myId → 0, never NaN', () => {
    expect(api.transformChatSession({ _id: 's1', unreadCount: { u1: 3 } }).unreadCount).toBe(0);
  });
  it('non-numeric entry → 0', () => {
    expect(api.transformChatSession({ _id: 's1', unreadCount: { u1: 'x' } }, 'u1').unreadCount).toBe(0);
  });
  it('another user\'s entry is not read', () => {
    expect(api.transformChatSession({ _id: 's1', unreadCount: { u2: 4 } }, 'u1').unreadCount).toBe(0);
  });
});

describe('chatApi.getSessions', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => okResponse({
      sessions: [
        { _id: 's1', participants: [], unreadCount: { u1: 2, '0': 9, '1': 9 } },
        { _id: 's2', participants: [], unreadCount: { u1: 1, '0': 9, '1': 9 } },
      ],
    }));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('uses myId for every row (map index never becomes the key)', async () => {
    const list = await api.chatApi.getSessions('u1');
    expect(list.map((s) => s.unreadCount)).toEqual([2, 1]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/chat\/sessions$/);
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });

  it('chatApi no longer exposes markRead (no backend route)', () => {
    expect((api.chatApi as any).markRead).toBeUndefined();
  });
});
