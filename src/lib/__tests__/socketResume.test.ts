// P7-02: foreground resume predicate.
import { shouldResumeSocket } from '../socketResume';

describe('shouldResumeSocket', () => {
  it('active + disconnected socket → resume', () => {
    expect(shouldResumeSocket('active', { connected: false })).toBe(true);
  });
  it('active + connected → no-op', () => {
    expect(shouldResumeSocket('active', { connected: true })).toBe(false);
  });
  it('background / inactive + disconnected → no-op (no retries while hidden)', () => {
    expect(shouldResumeSocket('background', { connected: false })).toBe(false);
    expect(shouldResumeSocket('inactive', { connected: false })).toBe(false);
  });
  it('active + no socket (logged out) → no-op, never creates one', () => {
    expect(shouldResumeSocket('active', null)).toBe(false);
  });
});
