// D10: handleResponse calls the registered session-expired handler on a protected
// 401 only — never for auth-flow 401s (wrong MPIN/OTP), 403 or 429.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

import { createSessionExpiryGate } from '../sessionExpiry';

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

describe('session-expired handler (D10)', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  let handler: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(401, { error: 'Session expired - Please login again' }));
    (global as any).fetch = fetchMock;
    api = require('../api');
    handler = jest.fn();
    api.setSessionExpiredHandler(handler);
  });

  it('protected 401 → handler called once and ApiError 401 still thrown', async () => {
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('login 401 (wrong MPIN) → handler not called', async () => {
    fetchMock.mockImplementation(async () => response(401, { error: 'Invalid credentials' }));
    await expect(api.authApi.login('9000000000', '1234')).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('register / verify-otp / forgot-mpin / reset-mpin 401 → not called', async () => {
    await expect(api.authApi.register({ name: 'n', phone: '9', mpin: '1' })).rejects.toMatchObject({ status: 401 });
    await expect(api.authApi.verifyOtp('9', '000000')).rejects.toMatchObject({ status: 401 });
    await expect(api.authApi.forgotMpin('9')).rejects.toMatchObject({ status: 401 });
    await expect(api.authApi.resetMpin('9', '000000', '1234')).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('403 → not called', async () => {
    fetchMock.mockImplementation(async () => response(403, { error: 'Forbidden' }));
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 403 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('429 → not called (rate-limit path)', async () => {
    fetchMock.mockImplementation(async () => response(429, { error: 'Too many requests' }));
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('3 parallel 401s through a gate → one logout', async () => {
    const logout = jest.fn(async () => {});
    const gate = createSessionExpiryGate(logout);
    api.setSessionExpiredHandler(() => { gate.trigger(); });
    await Promise.allSettled([
      api.employeeApiExtended.getMyEmployees(),
      api.chatApi.getSessions('u1'),
      api.adminApi.getUsers(),
    ]);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  // Review F1: /crm-bridge/* passes LeadGen's own 4xx through, so its 401 is
  // not proof the HIT session died.
  it('/crm-bridge/* 401 → handler not called, ApiError still thrown', async () => {
    fetchMock.mockImplementation(async () => response(401, { error: 'LeadGen unauthorized' }));
    await expect(api.crmBridgeApi.getAnalytics()).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.getStatus()).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.autoLink()).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.getLeads()).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.getLeadById('l1')).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.getJourney('l1')).rejects.toMatchObject({ status: 401 });
    await expect(api.crmBridgeApi.advanceStage('l1', { stage: 'Contacted' })).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    // A protected 401 right after still fires exactly once.
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // Review F1/F2: isSessionRejected asks /users/me with the CURRENT token.
  it('isSessionRejected: /users/me 401 → true; 200 / 500 / 429 / network → false', async () => {
    fetchMock.mockImplementation(async () => response(401, {}));
    await expect(api.authApi.isSessionRejected()).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])).toMatch(/\/users\/me$/);
    fetchMock.mockImplementation(async () => response(200, { id: 'u1' }));
    await expect(api.authApi.isSessionRejected()).resolves.toBe(false);
    fetchMock.mockImplementation(async () => response(500, {}));
    await expect(api.authApi.isSessionRejected()).resolves.toBe(false);
    fetchMock.mockImplementation(async () => response(429, {}));
    await expect(api.authApi.isSessionRejected()).resolves.toBe(false);
    fetchMock.mockImplementation(async () => { throw new TypeError('Network request failed'); });
    await expect(api.authApi.isSessionRejected()).resolves.toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('stale 401 (previous account) while the current token is valid → no logout', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      /\/users\/me$/.test(String(url)) ? response(200, { id: 'B' }) : response(401, { error: 'Session expired - Please login again' }));
    const logout = jest.fn(async () => {});
    const gate = createSessionExpiryGate(logout, () => api.authApi.isSessionRejected());
    api.setSessionExpiredHandler(() => { gate.trigger(); });
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 401 });
    await new Promise((r) => setTimeout(r, 0));
    expect(logout).not.toHaveBeenCalled();
  });

  it('3 parallel protected 401s with confirm (token really dead) → one logout', async () => {
    const logout = jest.fn(async () => {});
    const gate = createSessionExpiryGate(logout, () => api.authApi.isSessionRejected());
    api.setSessionExpiredHandler(() => { gate.trigger(); });
    await Promise.allSettled([
      api.employeeApiExtended.getMyEmployees(),
      api.chatApi.getSessions('u1'),
      api.adminApi.getUsers(),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(logout).toHaveBeenCalledTimes(1);
    const meCalls = fetchMock.mock.calls.filter((c: any[]) => /\/users\/me$/.test(String(c[0])));
    expect(meCalls).toHaveLength(1);
  });

  it('unregister stops calls', async () => {
    const other = jest.fn();
    const unregister = api.setSessionExpiredHandler(other);
    unregister();
    await expect(api.employeeApiExtended.getMyEmployees()).rejects.toMatchObject({ status: 401 });
    expect(other).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
