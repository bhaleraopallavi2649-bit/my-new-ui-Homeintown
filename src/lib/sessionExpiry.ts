// D10: one-shot gate for "the server says this session is dead" (a 401 on a
// protected endpoint). Screens fire requests in parallel, so a dead token
// produces several 401s at once; without a gate each would run its own logout
// (several SecureStore clears, socket disconnects and toasts). The first
// trigger runs onExpire, the rest are ignored until reset() re-arms the gate
// (the next signed-in user). No imports, so it is testable under jest node.
//
// `confirm` (review F1/F2): a 401 alone does not prove the CURRENT token is
// dead. PREVIOUS BEHAVIOUR: any protected 401 logged out at once, so a slow
// request from account A that 401'd after B signed in logged B out, and a
// backend route passing an upstream 401 through did the same with a valid
// token. When given, confirm() is asked first; false/reject re-arms the gate
// without logging out. Parallel triggers while it runs are still ignored.
export function createSessionExpiryGate(
  onExpire: () => void | Promise<void>,
  confirm?: () => Promise<boolean>,
) {
  let fired = false;
  const runExpire = () => {
    try {
      const r = onExpire();
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
    } catch {
      // A failing logout must never surface as a crash in whichever request
      // happened to be the one that saw the 401.
    }
  };
  return {
    trigger(): boolean {
      if (fired) return false;
      fired = true;
      if (!confirm) {
        runExpire();
        return true;
      }
      let check: Promise<boolean>;
      try { check = Promise.resolve(confirm()); } catch { check = Promise.resolve(false); }
      check
        .catch(() => false)
        .then((dead) => {
          if (dead) runExpire();
          else fired = false;
        });
      return true;
    },
    reset(): void {
      fired = false;
    },
  };
}
