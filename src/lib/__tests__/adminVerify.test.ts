// D13: the admin Verify toggle sent { verified } where PUT /users/:id/verify
// (user.routes.js) requires { status }, so every tap was a 400.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

import { isBuilderVerified, verificationAfterToggle } from '../adminUsers';
import type { AdminUser } from '../api';

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}

const base: AdminUser = { id: 'u1', name: 'C', role: 'captain', phone: '9000000002', isActive: true, verificationStatus: { agent: 'pending' } };

describe('adminApi.setVerified (D13)', () => {
  let api: typeof import('../api');
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => response(200, { message: 'Verification status updated', user: { id: 'u1', name: 'C', verificationStatus: { builder: 'verified' } } }));
    (global as any).fetch = fetchMock;
    api = require('../api');
  });

  it('setVerified(true) PUTs { status: "verified" } to /users/:id/verify', async () => {
    const res = await api.adminApi.setVerified('u1', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/users\/u1\/verify$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ status: 'verified' });
    expect(res.user?.verificationStatus?.builder).toBe('verified');
  });

  it('setVerified(false) sends { status: "unverified" }', async () => {
    await api.adminApi.setVerified('u1', false);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'unverified' });
  });

  it('never sends the old { verified } key', async () => {
    await api.adminApi.setVerified('u1', true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('verified');
  });

  it('400 "Verification is only for captains/builders" surfaces as ApiError message', async () => {
    fetchMock.mockImplementationOnce(async () => response(400, { error: 'Verification is only for captains/builders' }));
    await expect(api.adminApi.setVerified('u2', true)).rejects.toMatchObject({
      message: 'Verification is only for captains/builders',
      status: 400,
    });
  });
});

describe('verification mappers (D13)', () => {
  it('isBuilderVerified reads verificationStatus.builder', () => {
    expect(isBuilderVerified({ verificationStatus: { builder: 'verified' } })).toBe(true);
    expect(isBuilderVerified({ verificationStatus: { builder: 'pending' } })).toBe(false);
    expect(isBuilderVerified({ verificationStatus: { agent: 'verified' } })).toBe(false);
    expect(isBuilderVerified({})).toBe(false);
  });

  it('verificationAfterToggle prefers the server verificationStatus', () => {
    const next = verificationAfterToggle(base, true, { builder: 'verified', agent: 'unverified' });
    expect(next.verificationStatus).toEqual({ builder: 'verified', agent: 'unverified' });
  });

  it('verificationAfterToggle falls back to a local builder flip and keeps agent', () => {
    expect(verificationAfterToggle(base, true).verificationStatus).toEqual({ agent: 'pending', builder: 'verified' });
    expect(verificationAfterToggle(base, false).verificationStatus).toEqual({ agent: 'pending', builder: 'unverified' });
  });
});
