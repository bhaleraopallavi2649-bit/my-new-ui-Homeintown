import { shouldAutoScrollToEnd } from '../autoScroll';

describe('shouldAutoScrollToEnd', () => {
  it('first render after history load with no messages → no scroll', () => {
    expect(shouldAutoScrollToEnd(-1, 0)).toBe(false);
  });

  it('bulk history restore must not yank the view to the bottom', () => {
    expect(shouldAutoScrollToEnd(-1, 20)).toBe(false);
  });

  it('one genuinely-new message → scroll once', () => {
    expect(shouldAutoScrollToEnd(2, 3)).toBe(true);
  });

  it('re-render with no new message → no scroll (kills the flicker)', () => {
    expect(shouldAutoScrollToEnd(3, 3)).toBe(false);
  });

  it('undo / reset / disappear shrinks the list → no scroll', () => {
    expect(shouldAutoScrollToEnd(5, 2)).toBe(false);
  });
});
