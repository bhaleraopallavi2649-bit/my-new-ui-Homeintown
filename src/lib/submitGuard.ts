// P7-06: synchronous in-flight guard for submit handlers.
//
// `disabled={submitting}` alone is not enough: the state flips on the next
// render, so two taps inside the same frame both reach the handler. A plain
// closure flag is set synchronously on the first call. No react-native import,
// so jest (node env) can test it.

export interface SubmitGuard {
  /** Runs fn unless a previous run is still in flight; then returns undefined. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  readonly busy: boolean;
}

export function createSubmitGuard(): SubmitGuard {
  let busy = false;
  return {
    get busy() { return busy; },
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await fn();
      } finally {
        // Released on failure too, so one error never wedges the button.
        busy = false;
      }
    },
  };
}
