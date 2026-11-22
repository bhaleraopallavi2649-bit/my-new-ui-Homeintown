// Pure scroll-decision helper for chat transcripts. Kept free of react-native
// imports so jest (node env) can test it directly.
//
// Background: the AI Assistant transcript used to auto-scroll from TWO sources
// at once — the FlatList's `onContentSizeChange` fired `scrollToEnd` on every
// layout settle, AND `reveal()` fired its own timed `scrollDown` twice per
// message. During the warm-ui layout (bubble gaps, padding, a conditional
// footer) those two scrolls — one animated, one not — raced across multiple
// layout passes and the view visibly flickered/jumped on open. The fix drives a
// single scroll off the visible message COUNT, so we scroll once per genuinely
// new message and never on a bare re-render or a history restore.

/**
 * Decide whether a list should auto-scroll to the end.
 *
 * @param prevCount the message count we last scrolled for. A negative value
 *   means "first render after a bulk history load" — we must NOT yank the view
 *   to the bottom in that case.
 * @param nextCount the current message count.
 * @returns true only when genuinely-new messages were appended (count grew).
 *   A re-render with an unchanged count returns false (this is what kills the
 *   flicker); a shrinking count (undo / reset / disappearing-messages) also
 *   returns false so those never auto-scroll.
 */
export function shouldAutoScrollToEnd(prevCount: number, nextCount: number): boolean {
  if (prevCount < 0) return false; // history-load pass — do not scroll
  return nextCount > prevCount; // scroll only on true growth
}
