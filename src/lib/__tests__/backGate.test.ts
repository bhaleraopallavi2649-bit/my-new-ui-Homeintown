import { registerHardwareBack, BackHandlerLike } from '../backGate';

// Fake LIFO BackHandler: like RN, the most recently added listener runs first;
// if no listener returns true the default action (pop/exit) happens.
function makeFakeBackHandler() {
  const stack: Array<() => boolean> = [];
  let defaultPop = 0;
  const bh: BackHandlerLike = {
    addEventListener(_e, h) {
      stack.push(h);
      return { remove: () => { const i = stack.lastIndexOf(h); if (i >= 0) stack.splice(i, 1); } };
    },
  };
  const press = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i]()) return;
    defaultPop++;
  };
  return { bh, press, count: () => stack.length, defaultPop: () => defaultPop };
}

describe('registerHardwareBack', () => {
  it('enabled: registers one listener that runs the LATEST handler and consumes the press', () => {
    const f = makeFakeBackHandler();
    const first = jest.fn();
    const second = jest.fn();
    const ref = { current: first };
    registerHardwareBack(f.bh, true, ref);
    expect(f.count()).toBe(1);
    ref.current = second;
    f.press();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(f.defaultPop()).toBe(0);
  });

  it('disabled: registers nothing, default back runs', () => {
    const f = makeFakeBackHandler();
    const h = jest.fn();
    const cleanup = registerHardwareBack(f.bh, false, { current: h });
    expect(f.count()).toBe(0);
    f.press();
    expect(h).not.toHaveBeenCalled();
    expect(f.defaultPop()).toBe(1);
    expect(() => cleanup()).not.toThrow();
  });

  it('cleanup (blur) removes the listener so default back runs', () => {
    const f = makeFakeBackHandler();
    const h = jest.fn();
    const cleanup = registerHardwareBack(f.bh, true, { current: h });
    cleanup();
    f.press();
    expect(h).not.toHaveBeenCalled();
    expect(f.defaultPop()).toBe(1);
  });

  it('re-register after cleanup (refocus) handles back again', () => {
    const f = makeFakeBackHandler();
    const h = jest.fn();
    const ref = { current: h };
    registerHardwareBack(f.bh, true, ref)();
    registerHardwareBack(f.bh, true, ref);
    f.press();
    expect(h).toHaveBeenCalledTimes(1);
    expect(f.defaultPop()).toBe(0);
  });
});
