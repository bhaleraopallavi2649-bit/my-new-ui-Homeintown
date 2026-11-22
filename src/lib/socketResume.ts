// P7-02: when the app returns to the foreground, decide whether to kick the
// shared socket. Kept free of react-native imports so jest (node env) can test
// it directly.
//
// Background: socket.io gives up after `reconnectionAttempts`. Previously the
// cap was 5 with nothing listening to AppState, so a phone that was offline
// for ~30 s (tunnel, airplane mode, Doze) stayed disconnected for the rest of
// the session — chat looked fine but no live message ever arrived again.

/** True only when the app is active and an existing socket is not connected. */
export function shouldResumeSocket(state: string, s: { connected: boolean } | null): boolean {
  return state === 'active' && !!s && !s.connected;
}
