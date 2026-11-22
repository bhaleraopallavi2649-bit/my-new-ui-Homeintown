// matchCountIds decides which ids the Marketplace sends to match-counts. The
// cap matters: the backend slices to 100, so sending a larger superset would
// lose counts for cards the user can see.
import { matchCountIds, MATCH_COUNT_ID_CAP } from '../matchCountIds';

const range = (n: number, prefix = 'p') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('matchCountIds', () => {
  it('cap is the backend slice size', () => {
    expect(MATCH_COUNT_ID_CAP).toBe(100);
  });

  it('returns the whole loaded set when it is within the cap', () => {
    const all = range(100);
    const visible = all.slice(0, 3);
    const out = matchCountIds(all, visible);
    expect(out).toHaveLength(100);
    expect(new Set(out)).toEqual(new Set(all));
  });

  it('falls back to the visible set when the loaded set exceeds the cap', () => {
    const all = range(101);
    const visible = ['p5', 'p7', 'p5'];
    expect(matchCountIds(all, visible)).toEqual(['p5', 'p7']);
  });

  it('drops duplicates and empty ids', () => {
    expect(matchCountIds(['b', '', 'a', 'b', ''], [])).toEqual(['a', 'b']);
    expect(matchCountIds([], [])).toEqual([]);
  });

  it('is order-independent, so a tab/view switch keeps the same cache key', () => {
    const a = matchCountIds(['c', 'a', 'b'], ['a']);
    const b = matchCountIds(['b', 'c', 'a'], ['c', 'b']);
    expect(a).toEqual(b);
  });
});
