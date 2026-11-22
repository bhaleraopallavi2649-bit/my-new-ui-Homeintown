// Session-resolution helpers for authContext (P6-03 / P6-03b).
//
// Pure functions with injected effects, so the ordering guarantees can be tested
// under jest's node environment without rendering the provider.

/**
 * Run `ensure` (per-user storage owner check) BEFORE the user is committed to
 * React state, then commit only if this resolution is still the current one.
 *
 * Why the order matters: AI Assist and the group chat read their per-user
 * AsyncStorage keys as soon as the dashboard mounts, and the dashboard mounts
 * as soon as status becomes authenticated. Committing first would let the new
 * user's screens read the previous user's keys before they were cleared.
 *
 * `isCurrent` guards against a late resolution (e.g. a logout or another
 * session check started while `ensure` was awaiting) overwriting newer state.
 * An `ensure` failure never blocks sign-in.
 */
export async function commitAuthenticatedUser<U extends { id: string }>(
  user: U,
  ensure: (id: string) => Promise<void>,
  commit: (u: U) => void,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  try {
    await ensure(user.id);
  } catch {
    // ignore: storage hygiene must never lock the user out
  }
  if (!isCurrent()) return false;
  commit(user);
  return true;
}

/**
 * True once a signed-in user has been fully resolved (owner check done and
 * status committed). The dashboard layout renders nothing user-specific until
 * then, so no screen can mount — and read per-user storage — mid-resolution.
 */
export function isSessionReady(status: string, user: { id?: string } | null | undefined): boolean {
  return !!user?.id && (status === 'authenticated' || status === 'unassigned');
}
