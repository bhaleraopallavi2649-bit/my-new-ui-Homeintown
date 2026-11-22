// P4-03: Field "Log Meeting" now posts to the existing POST /employee/meeting.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

// Module scope, so this file's helpers do not collide with other test scripts' globals under tsc.
export {};

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

const body = {
  withWhom: 'Client',
  description: 'Notes',
  latitude: 18.5,
  longitude: 73.8,
  placeName: 'Pune',
  projectName: 'P',
  projectLocation: 'L',
  projectPrice: '50L',
};

describe('employeeApi.logMeeting', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, { message: 'Meeting logged successfully', log: {} }));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('POSTs the controller field names with Bearer auth', async () => {
    await api.employeeApi.logMeeting(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/employee\/meeting$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tkn');
    const sent = JSON.parse(init.body);
    expect(Object.keys(sent).sort()).toEqual(
      ['withWhom', 'description', 'latitude', 'longitude', 'placeName', 'projectName', 'projectLocation', 'projectPrice'].sort(),
    );
    expect(sent).toEqual(body);
  });

  it('surfaces the backend 403 { error } text', async () => {
    fetchMock.mockImplementationOnce(async () => response(403, { error: 'Employer assignment not confirmed' }));
    await expect(api.employeeApi.logMeeting(body)).rejects.toMatchObject({
      message: 'Employer assignment not confirmed',
      status: 403,
    });
  });
});
