// D12: reconnect refetch merge — appendMessage semantics, no dup, no reorder.
import { mergeFetchedMessages } from '../messageMerge';

const m = (id: string, content = id) => ({ id, content });

describe('mergeFetchedMessages (D12)', () => {
  it('appends only unseen ids in fetched order', () => {
    const out = mergeFetchedMessages([m('a'), m('b')], [m('a'), m('b'), m('c'), m('d')]);
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never duplicates an id already on screen', () => {
    const out = mergeFetchedMessages([m('a'), m('live1')], [m('a'), m('live1'), m('x')]);
    expect(out.filter(x => x.id === 'live1')).toHaveLength(1);
    expect(out.map(x => x.id)).toEqual(['a', 'live1', 'x']);
  });

  it('keeps existing order (no reordering)', () => {
    const current = [m('c'), m('a'), m('b')];
    const out = mergeFetchedMessages(current, [m('a'), m('b'), m('c'), m('z')]);
    expect(out.slice(0, 3)).toEqual(current);
    expect(out[3].id).toBe('z');
  });

  it('dedups repeats inside fetched', () => {
    expect(mergeFetchedMessages([], [m('a'), m('a'), m('b')]).map(x => x.id)).toEqual(['a', 'b']);
  });

  it('returns the same reference when nothing is new', () => {
    const current = [m('a'), m('b')];
    expect(mergeFetchedMessages(current, [m('a')])).toBe(current);
    expect(mergeFetchedMessages(current, [])).toBe(current);
  });

  it('empty current → fetched', () => {
    expect(mergeFetchedMessages([], [m('a'), m('b')]).map(x => x.id)).toEqual(['a', 'b']);
  });
});
