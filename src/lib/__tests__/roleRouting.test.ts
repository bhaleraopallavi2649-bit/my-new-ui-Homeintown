// D9: role landing + Chats 403 copy.
import { homeRouteForRole, OVERVIEW_ROLES, chatsErrorMessage, isChatsForbidden } from '../roleRouting';

describe('roleRouting (D9)', () => {
  it('employee → /(dashboard)/field', () => {
    expect(homeRouteForRole('employee')).toBe('/(dashboard)/field');
  });

  it('user / unassigned / admin / builder / agent / captain → /(dashboard)/crm', () => {
    for (const r of ['user', 'unassigned', 'admin', 'builder', 'agent', 'captain']) {
      expect(homeRouteForRole(r)).toBe('/(dashboard)/crm');
    }
  });

  it('undefined / null role → crm', () => {
    expect(homeRouteForRole(undefined)).toBe('/(dashboard)/crm');
    expect(homeRouteForRole(null)).toBe('/(dashboard)/crm');
  });

  it('OVERVIEW_ROLES includes user and unassigned, excludes employee', () => {
    expect(OVERVIEW_ROLES).toEqual(expect.arrayContaining(['user', 'unassigned', 'admin', 'builder', 'captain', 'agent']));
    expect(OVERVIEW_ROLES as readonly string[]).not.toContain('employee');
  });

  it('403 → role-assignment message', () => {
    expect(chatsErrorMessage({ status: 403, message: 'Forbidden' })).toBe('Chats are available after your account is assigned a role.');
  });

  it('network / 500 → generic retry message', () => {
    const generic = "Couldn't load conversations. Check your connection and try again.";
    expect(chatsErrorMessage(new TypeError('Network request failed'))).toBe(generic);
    expect(chatsErrorMessage({ status: 500 })).toBe(generic);
    expect(chatsErrorMessage(null)).toBe(generic);
  });

  it('isChatsForbidden only for 403', () => {
    expect(isChatsForbidden({ status: 403 })).toBe(true);
    for (const v of [{ status: 401 }, { status: 500 }, new Error('x'), null, undefined]) expect(isChatsForbidden(v)).toBe(false);
  });
});
