// Pure helper for the 1:1 Chats list unread badge (no react-native import, so
// it runs in the jest node environment).
//
// The backend emits `notification { type: 'new_chat_message', sessionId }` to
// every other participant's personal room on each send (chat.socket.js), and
// the server joins that personal room itself on connect. The Chats list never
// listened for it, so a badge only changed after a remount refetched sessions.

/**
 * Returns `sessions` with the matching row's unreadCount + 1.
 *
 * Returns the SAME array reference (so React skips the re-render) when there is
 * nothing to bump: no sessionId, the thread is the one currently open (the
 * user is reading it), or the session is not in the loaded list (a brand-new
 * chat; refetching for that is out of scope here).
 */
export function bumpSessionUnread<T extends { id: string; unreadCount: number }>(
  sessions: T[],
  sessionId: string | undefined,
  activeId: string | null,
): T[] {
  if (!sessionId || sessionId === activeId) return sessions;
  if (!sessions.some((s) => s.id === sessionId)) return sessions;
  return sessions.map((s) => (s.id === sessionId ? { ...s, unreadCount: (s.unreadCount || 0) + 1 } : s));
}
