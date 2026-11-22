// Which project ids the Marketplace asks /lead-matching/match-counts about.
//
// The screen used to send only the ids of the *visible, filtered* listings.
// projectsApiExtended.matchCounts caches on the sorted id list, so every tab or
// Buy/Sell/All switch produced a different list, missed the 60 s cache and
// cost another ~0.85 s server-side call for counts it mostly already had.
// Asking for the whole loaded set (listings + mine) instead gives one stable
// cache key across those switches.
//
// The backend only answers for the first 100 ids (`slice(0, 100)` in
// leadMatching.routes.js), so a superset larger than that would silently drop
// counts for visible cards. Past the cap we fall back to the visible set, which
// is exactly the previous behaviour.
export const MATCH_COUNT_ID_CAP = 100;

function dedupe(ids: string[]): string[] {
  return Array.from(new Set((ids || []).filter(Boolean).map(String)));
}

export function matchCountIds(
  allIds: string[],
  visibleIds: string[],
  cap: number = MATCH_COUNT_ID_CAP,
): string[] {
  const all = dedupe(allIds);
  // Sorted so the result is order-independent; the api cache key sorts too,
  // this just keeps the helper's own output stable for callers and tests.
  if (all.length <= cap) return all.sort();
  return dedupe(visibleIds);
}
