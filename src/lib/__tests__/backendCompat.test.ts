// P4-09: locks the mobile side of the backend's current (uncommitted) contract
// changes, so the app works against BOTH the live and the new backend:
//  - /api/files/* now require auth → proxy-upload must send Bearer.
//  - /api/public/projects returns owner.phone only to signed-in callers.
//  - /api/analytics/projects/:id is now `protect`ed.
//  - getRooms gains additive memberCount / newMemberCount7d.
//  - group getMessages caps `limit` at 100; mobile sends none (server default 50).
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

// Module scope, so this file's helpers do not collide with other test scripts' globals under tsc.
export {};

function okResponse(body: any) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
}

class FakeFormData {
  entries: Array<[string, any]> = [];
  append(k: string, v: any) { this.entries.push([k, v]); }
}

describe('backend contract compatibility', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  let realFormData: any;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => okResponse({}));
    (global as any).fetch = fetchMock;
    realFormData = (global as any).FormData;
    (global as any).FormData = FakeFormData;
    api = require('../api');
  });
  afterEach(() => { (global as any).FormData = realFormData; });

  it('fetchPublicProjectsRaw sends Bearer and passes owners without phone through as-is', async () => {
    const list = [{ _id: 'p1', projectName: 'X', owner: { _id: 'o1', name: 'Owner' } }];
    fetchMock.mockImplementationOnce(async () => okResponse(list));
    const data = await api.fetchPublicProjectsRaw(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/public\/projects$/);
    expect(init.headers.Authorization).toBe('Bearer tkn');
    expect(data).toEqual(list);
    expect(data[0].owner.phone).toBeUndefined();
  });

  it('mediaApi.uploadAndSave → POST /files/proxy-upload with Bearer and no Content-Type', async () => {
    fetchMock.mockImplementationOnce(async () => okResponse({ fileUrl: 'https://cdn/x', fileKey: 'projects/p1/cover/x' }));
    const res = await api.mediaApi.uploadAndSave({ uri: 'file:///x.jpg', name: 'x.jpg', mimeType: 'image/jpeg', projectId: 'p1', type: 'cover' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/files\/proxy-upload$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tkn');
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    const keys = (init.body as FakeFormData).entries.map(([k]) => k);
    expect(keys).toEqual(['file', 'projectId', 'type']);
    expect(res).toEqual({ url: 'https://cdn/x', key: 'projects/p1/cover/x' });
  });

  it('analyticsApi.projectDetail sends Bearer', async () => {
    await api.analyticsApi.projectDetail('p1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/analytics\/projects\/p1$/);
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });

  it('getRooms tolerates the additive memberCount / newMemberCount7d fields', async () => {
    fetchMock.mockImplementationOnce(async () => okResponse({
      myRooms: [{
        _id: 'r1', name: 'Room', roomType: 'builder', memberCount: 7, newMemberCount7d: 2,
        members: [{ user: { _id: 'u1', name: 'A' }, role: 'admin' }, { user: { _id: 'u2', name: 'B' }, role: 'member' }],
      }],
      discoverRooms: [],
    }));
    const { myRooms, discoverRooms } = await api.groupChatApi.getRooms();
    expect(myRooms).toHaveLength(1);
    expect(myRooms[0].id).toBe('r1');
    expect(myRooms[0].members).toHaveLength(2);
    expect(discoverRooms).toEqual([]);
  });

  it('getRooms still works on the old shape (no count fields)', async () => {
    fetchMock.mockImplementationOnce(async () => okResponse({ myRooms: [{ _id: 'r1', members: [] }], discoverRooms: [] }));
    const { myRooms } = await api.groupChatApi.getRooms();
    expect(myRooms[0].members).toEqual([]);
  });

  it('group getMessages sends no limit (server default 50, cap 100)', async () => {
    fetchMock.mockImplementationOnce(async () => okResponse({ messages: [] }));
    await api.groupChatApi.getMessages('r');
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/group-chat\/rooms\/r\/messages$/);
    expect(String(url)).not.toMatch(/limit=/);
  });
});
