// D3: bounded retry then 'offline' for transient cold-start failures.
import {
  classifySessionStatus, nextSessionAction, MAX_TRANSIENT_RETRIES,
  TRANSIENT_DELAY_MIN_MS, TRANSIENT_DELAY_MAX_MS,
} from '../sessionRetry';

describe('sessionRetry (D3)', () => {
  it('classifies 401/403/404 as unauthenticated', () => {
    for (const s of [401, 403, 404]) expect(classifySessionStatus(s)).toBe('unauthenticated');
  });

  it('classifies 429 as rate_limited', () => {
    expect(classifySessionStatus(429)).toBe('rate_limited');
  });

  it('classifies 500/502/503 as transient', () => {
    for (const s of [500, 502, 503]) expect(classifySessionStatus(s)).toBe('transient');
  });

  it('transient attempt 0 → retry 2000 ms, attempt 1 → retry 4000 ms (clamped)', () => {
    const t = { authenticated: false, user: null, transient: true };
    expect(nextSessionAction(t, 0)).toEqual({ kind: 'retry', delayMs: 2000 });
    expect(nextSessionAction(t, 1)).toEqual({ kind: 'retry', delayMs: 4000 });
    for (let i = 0; i < MAX_TRANSIENT_RETRIES; i++) {
      const a = nextSessionAction(t, i);
      if (a.kind !== 'retry') throw new Error('expected retry');
      expect(a.delayMs).toBeGreaterThanOrEqual(TRANSIENT_DELAY_MIN_MS);
      expect(a.delayMs).toBeLessThanOrEqual(TRANSIENT_DELAY_MAX_MS);
    }
  });

  it('bounded: attempt 2 → offline (no third retry)', () => {
    const t = { authenticated: false, user: null, transient: true };
    expect(MAX_TRANSIENT_RETRIES).toBe(2);
    expect(nextSessionAction(t, 2)).toEqual({ kind: 'offline' });
    expect(nextSessionAction(t, 9)).toEqual({ kind: 'offline' });
  });

  it('retry success → commit (transient, then authenticated)', () => {
    expect(nextSessionAction({ authenticated: false, user: null, transient: true }, 0).kind).toBe('retry');
    expect(nextSessionAction({ authenticated: true, user: { id: 'u1' } }, 1)).toEqual({ kind: 'commit' });
  });

  it('authenticated:false without transient → unauthenticated', () => {
    expect(nextSessionAction({ authenticated: false, user: null }, 0)).toEqual({ kind: 'unauthenticated' });
  });
});
