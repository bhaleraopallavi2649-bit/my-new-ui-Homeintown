// Android hardware-back registration for an open chat thread.
//
// WHY: neither GroupChatEmbedded nor ChatEmbedded handled hardware back (0
// BackHandler uses in the app), so with a room/thread open the Android back
// button skipped the in-pane "back to list" step and popped/exited the whole
// screen. Callers register this inside useFocusEffect so a screen left mounted
// underneath a pushed route (Sidebar uses router.push) does not keep eating
// back presses meant for the screen on top.
//
// No `react-native` import on purpose: the BackHandler is injected, so this is
// testable in jest's node environment.

export interface BackHandlerLike {
  addEventListener(event: 'hardwareBackPress', handler: () => boolean): { remove(): void };
}

export function registerHardwareBack(
  bh: BackHandlerLike,
  enabled: boolean,
  handlerRef: { current: () => void },
): () => void {
  if (!enabled) return () => {};
  // Read the ref at press time, so the latest handler (fresh closure over the
  // current room) runs without re-registering on every render.
  const sub = bh.addEventListener('hardwareBackPress', () => {
    handlerRef.current();
    return true;
  });
  return () => sub.remove();
}
