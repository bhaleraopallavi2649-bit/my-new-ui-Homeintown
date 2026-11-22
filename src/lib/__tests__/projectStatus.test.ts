import { matchesStatusFilter } from '../projectStatus';

describe('matchesStatusFilter', () => {
  it('Ready chip matches the app-written ready-to-move value', () => {
    expect(matchesStatusFilter('ready-to-move', 'ready')).toBe(true);
  });
  it('Ready chip still matches legacy "ready"', () => {
    expect(matchesStatusFilter('ready', 'ready')).toBe(true);
  });
  it('under-construction is not Ready', () => {
    expect(matchesStatusFilter('under-construction', 'ready')).toBe(false);
  });
  it('other chips compare exactly', () => {
    expect(matchesStatusFilter('pre-launch', 'pre-launch')).toBe(true);
    expect(matchesStatusFilter('ready-to-move', 'pre-launch')).toBe(false);
  });
  it('All matches everything, including a missing status', () => {
    expect(matchesStatusFilter('ready-to-move', 'All')).toBe(true);
    expect(matchesStatusFilter(undefined, 'All')).toBe(true);
  });
  it('missing status never matches a specific chip', () => {
    expect(matchesStatusFilter(undefined, 'ready')).toBe(false);
  });
});
