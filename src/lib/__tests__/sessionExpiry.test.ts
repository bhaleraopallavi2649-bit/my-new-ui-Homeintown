// D10: the one-shot gate that turns any number of parallel 401s into one logout.
import { createSessionExpiryGate } from '../sessionExpiry';

describe('createSessionExpiryGate', () => {
  it('first trigger runs onExpire once', () => {
    const onExpire = jest.fn();
    const gate = createSessionExpiryGate(onExpire);
    expect(gate.trigger()).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('parallel triggers before reset → one onExpire', () => {
    const onExpire = jest.fn();
    const gate = createSessionExpiryGate(onExpire);
    const fired = [gate.trigger(), gate.trigger(), gate.trigger()];
    expect(fired).toEqual([true, false, false]);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('reset re-arms the gate', () => {
    const onExpire = jest.fn();
    const gate = createSessionExpiryGate(onExpire);
    gate.trigger();
    gate.reset();
    gate.trigger();
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it('onExpire rejection / throw is swallowed', async () => {
    const rejecting = createSessionExpiryGate(() => Promise.reject(new Error('x')));
    expect(() => rejecting.trigger()).not.toThrow();
    const throwing = createSessionExpiryGate(() => { throw new Error('y'); });
    expect(() => throwing.trigger()).not.toThrow();
    await Promise.resolve();
  });

  // Review F1/F2: confirm() decides whether the current session is really dead.
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it('confirm true -> onExpire once, even with parallel triggers', async () => {
    const onExpire = jest.fn();
    const confirm = jest.fn(async () => true);
    const gate = createSessionExpiryGate(onExpire, confirm);
    expect([gate.trigger(), gate.trigger(), gate.trigger()]).toEqual([true, false, false]);
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it('confirm false -> no onExpire and the gate re-arms', async () => {
    const onExpire = jest.fn();
    const confirm = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const gate = createSessionExpiryGate(onExpire, confirm);
    gate.trigger();
    await flush();
    expect(onExpire).not.toHaveBeenCalled();
    expect(gate.trigger()).toBe(true);
    await flush();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it('confirm reject / throw -> treated as not dead, no crash', async () => {
    const onExpire = jest.fn();
    const rejecting = createSessionExpiryGate(onExpire, () => Promise.reject(new Error('net')));
    expect(() => rejecting.trigger()).not.toThrow();
    const throwing = createSessionExpiryGate(onExpire, () => { throw new Error('sync'); });
    expect(() => throwing.trigger()).not.toThrow();
    await flush();
    expect(onExpire).not.toHaveBeenCalled();
  });
});
