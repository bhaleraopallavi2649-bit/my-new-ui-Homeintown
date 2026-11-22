// Tiny deterministic hash → index picker, shared by the placeholder art.
//
// WHY deterministic: a listing/room with no real image must get the SAME
// placeholder every render (and every app launch), otherwise the card's picture
// would flicker between variants on each re-render. A hash of a stable string
// (project id, room id, title…) gives a fixed-but-varied choice, so two
// different cards almost always get different art while one card never changes.

export function seedIndex(seed: string | undefined | null, count: number): number {
  if (count <= 0) return 0;
  const str = (seed && String(seed)) || 'placeholder';
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    // Classic 32-bit string hash (djb2-ish), kept tiny and dependency-free.
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % count;
}
