// D12: merge a refetched page into the messages already on screen.
//
// Same semantics as appendMessage in GroupChatEmbedded (dedup by id, append at
// the end): what is on screen keeps its order, and fetched messages whose id is
// not on screen yet are appended in fetched (server, oldest-first) order. Never
// reorders or duplicates. Returns the SAME array when nothing is new so React
// skips the re-render.
export function mergeFetchedMessages<T extends { id: string }>(current: T[], fetched: T[]): T[] {
  if (!fetched || fetched.length === 0) return current;
  const seen = new Set(current.map((m) => m.id));
  const additions: T[] = [];
  for (const m of fetched) {
    if (!m || !m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    additions.push(m);
  }
  return additions.length ? [...current, ...additions] : current;
}
