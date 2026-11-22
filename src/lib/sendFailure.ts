// D4: what a failed group text send does to the composer and what it says.
// Pure (no imports) so it is testable under jest node.

// Put the unsent text back without losing anything typed since. PREVIOUS
// BEHAVIOUR: the box was cleared before the request and never refilled, so a
// failed send threw the user's message away.
export function restoreDraftAfterFailedSend(current: string, sent: string): string {
  if (!String(current ?? '').trim()) return sent;
  return `${sent}\n${current}`;
}

export function sendFailureMessage(err: unknown): string {
  const e = err as { status?: number; message?: unknown } | null;
  const status = typeof e?.status === 'number' ? e.status : 0;
  const message = typeof e?.message === 'string' ? e.message.trim() : '';
  // 429 carries handleResponse's "Too many requests. Please try again in …".
  // Other 4xx carry the server's own reason (e.g. not a member any more).
  if (status >= 400 && status < 500 && message) return message;
  return 'Message not sent. Check your connection and try again.';
}
