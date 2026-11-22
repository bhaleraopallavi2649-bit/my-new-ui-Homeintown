// D14: GET /employee/my-employees answers a bare array (employeeController.getMyEmployees
// `res.json(employees)`); the old reader looked for `data.employees` and was always empty.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

// Shape of one row from the controller's .select('name phone email isActive role isEmployerConfirmed employerId').
const row = { _id: 'e1', name: 'Asha', phone: '9000000001', email: 'a@example.com', isActive: true, role: 'employee', isEmployerConfirmed: true, employerId: { _id: 'b1', name: 'B', phone: '9' } };
const mapped = { id: 'e1', name: 'Asha', phone: '9000000001', role: 'employee', isEmployerConfirmed: true };

describe('toEmployeeList / getMyEmployees (D14)', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, [row]));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('bare array (the shape employeeController.getMyEmployees sends) maps to items', () => {
    expect(api.toEmployeeList([row])).toEqual([mapped]);
  });

  it('{ employees: [...] } envelope', () => {
    expect(api.toEmployeeList({ employees: [row] })).toEqual([mapped]);
  });

  it('{ data: [...] } envelope', () => {
    expect(api.toEmployeeList({ data: [row] })).toEqual([mapped]);
  });

  it('{ data: { employees } } envelope', () => {
    expect(api.toEmployeeList({ data: { employees: [row] } })).toEqual([mapped]);
  });

  it('null / {} / string → [] and non-object entries are skipped', () => {
    expect(api.toEmployeeList(null)).toEqual([]);
    expect(api.toEmployeeList({})).toEqual([]);
    expect(api.toEmployeeList('nope')).toEqual([]);
    expect(api.toEmployeeList([null, 3, row])).toEqual([mapped]);
  });

  it('getMyEmployees calls GET /employee/my-employees with Bearer and maps a bare array', async () => {
    const list = await api.employeeApiExtended.getMyEmployees();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/employee\/my-employees$/);
    expect(init.headers.Authorization).toBe('Bearer tkn');
    expect(list).toEqual([mapped]);
  });
});
