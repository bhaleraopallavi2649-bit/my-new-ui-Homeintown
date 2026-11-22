// D12: tells a reconnect apart from the first connect of a socket session.
// socket.io fires 'connect' for both; only a REconnect means messages may have
// been missed while offline. Pure, so testable under jest node.
export function createReconnectTracker() {
  let connectedBefore = false;
  return {
    /** Call on every 'connect'. True only if a connect already happened. */
    onConnect(): boolean {
      const wasReconnect = connectedBefore;
      connectedBefore = true;
      return wasReconnect;
    },
    /** Logout: the next session's first connect is not a reconnect. */
    reset(): void {
      connectedBefore = false;
    },
  };
}
