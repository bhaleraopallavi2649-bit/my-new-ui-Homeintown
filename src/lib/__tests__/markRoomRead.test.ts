// P7-05: GroupChatEmbedded now calls markRoomRead on close / room switch too.
// Pins the request shape against the backend route
// (POST /group-chat/rooms/:roomId/read, auth required) and that a failure
// rejects, so the callers' `.catch(() => {})` is what keeps it silent.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function response(status: number, body: any) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

describe('groupChatApi.markRoomRead', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, { success: true }));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('POSTs /group-chat/rooms/:id/read with the Bearer token', async () => {
    await api.groupChatApi.markRoomRead('r1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/group-chat\/rooms\/r1\/read$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });

  it('encodes the room id', async () => {
    await api.groupChatApi.markRoomRead('a/b');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/group-chat\/rooms\/a%2Fb\/read$/);
  });

  it('rejects on a 500 so the caller decides to stay silent', async () => {
    fetchMock.mockImplementationOnce(async () => response(500, { message: 'boom' }));
    await expect(api.groupChatApi.markRoomRead('r1')).rejects.toBeTruthy();
  });
});
