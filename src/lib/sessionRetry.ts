// D3: what the cold-start session check does with each answer. Pure and
// import-free so it is testable under jest node.
//
// WHY: getSession used to fold "network down / server 5xx" into the same
// `authenticated: false` as a real logout, so a phone opened without signal
// (or during a backend restart) landed on the login screen even though the
// stored token was fine. A transient failure now retries a bounded number of
// times and then shows an "Offline — Retry" screen, never the login screen.

export type SessionStatusClass = 'rate_limited' | 'transient' | 'unauthenticated';

export function classifySessionStatus(status: number): SessionStatusClass {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'transient';
  return 'unauthenticated';
}

// Bounded like the rate-limit budget in authContext (MAX_RATE_LIMIT_RETRIES):
// two quick retries cover a blip, then the user gets a Retry button instead of
// an unbounded splash.
export const MAX_TRANSIENT_RETRIES = 2;
export const TRANSIENT_DELAY_MIN_MS = 2000;
export const TRANSIENT_DELAY_MAX_MS = 8000;

export type SessionAction =
  | { kind: 'retry'; delayMs: number }
  | { kind: 'offline' }
  | { kind: 'commit' }
  | { kind: 'unauthenticated' };

export function nextSessionAction(
  session: { authenticated: boolean; user: unknown; transient?: boolean },
  transientAttempts: number,
): SessionAction {
  if (session.transient) {
    if (transientAttempts < MAX_TRANSIENT_RETRIES) {
      const delayMs = Math.min(
        TRANSIENT_DELAY_MAX_MS,
        Math.max(TRANSIENT_DELAY_MIN_MS, TRANSIENT_DELAY_MIN_MS * 2 ** transientAttempts),
      );
      return { kind: 'retry', delayMs };
    }
    return { kind: 'offline' };
  }
  if (session.authenticated && session.user) return { kind: 'commit' };
  return { kind: 'unauthenticated' };
}
