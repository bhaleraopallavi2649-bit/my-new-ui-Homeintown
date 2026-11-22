import { leadsErrorKind } from '../crmLeadsError';

describe('leadsErrorKind', () => {
  it('ApiError-like NOT_LINKED code → not_linked', () => {
    expect(leadsErrorKind({ code: 'NOT_LINKED', status: 403 })).toBe('not_linked');
  });
  it('any other code → generic', () => {
    expect(leadsErrorKind({ code: 'X' })).toBe('generic');
  });
  it('plain Error (network) → generic', () => {
    expect(leadsErrorKind(new Error('Network request failed'))).toBe('generic');
  });
  it('undefined / null → generic', () => {
    expect(leadsErrorKind(undefined)).toBe('generic');
    expect(leadsErrorKind(null)).toBe('generic');
  });
});
