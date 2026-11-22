// P7-06: synchronous double-submit guard (add-project Save Draft / Publish).
import { createSubmitGuard } from '../submitGuard';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: any) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('createSubmitGuard', () => {
  it('two concurrent runs → fn runs once, the second returns undefined', async () => {
    const g = createSubmitGuard();
    const d = deferred<string>();
    const fn = jest.fn(() => d.promise);
    const first = g.run(fn);
    const second = g.run(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(g.busy).toBe(true);
    await expect(second).resolves.toBeUndefined();
    d.resolve('ok');
    await expect(first).resolves.toBe('ok');
    expect(g.busy).toBe(false);
  });

  it('after settling, a third run goes through', async () => {
    const g = createSubmitGuard();
    await g.run(async () => 1);
    const fn = jest.fn(async () => 3);
    await expect(g.run(fn)).resolves.toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a rejection releases the guard and reaches the caller', async () => {
    const g = createSubmitGuard();
    await expect(g.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(g.busy).toBe(false);
    await expect(g.run(async () => 'again')).resolves.toBe('again');
  });
});
