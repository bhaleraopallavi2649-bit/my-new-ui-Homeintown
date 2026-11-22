// Display-text sanitizers shared by the listing/detail cards.
//
// WHY: some cards stored an area built as `${x} sqft` where x was undefined, so
// the literal string 'undefined sqft' leaked straight into the UI. The old
// guards were plain truthiness checks (`area && ...`), which PASS for a
// non-empty string — and 'undefined sqft' / 'undefined' are non-empty strings —
// so the junk rendered anyway. These helpers treat those placeholder strings as
// empty and return '' so the line can be dropped with .filter(Boolean).

const BLANK_AREA = new Set(['', 'undefined', 'null', 'undefined sqft', 'nan']);

// Unit words we consider "already present" so we don't append a second unit.
const UNIT_SUFFIXES = ['sqft', 'sq ft', 'sq.ft', 'sqm', 'sq m', 'acre', 'acres', 'guntha', 'gunthas', 'cent', 'cents', 'yard', 'yards', 'sqyd', 'sq yd'];

/**
 * Human-readable area string, or '' when there is nothing real to show.
 * Returns '' for nullish, 0, or a string that trims/lowercases to one of the
 * known placeholder blanks ('', 'undefined', 'null', 'undefined sqft', 'nan').
 * Otherwise returns `${area} ${unit || 'sqft'}`, skipping the unit when the
 * area text already ends in a unit word.
 */
export function cleanAreaText(area?: string | number | null, unit?: string | null): string {
  if (area == null || area === 0) return '';
  const trimmed = String(area).trim();
  if (BLANK_AREA.has(trimmed.toLowerCase())) return '';

  const lower = trimmed.toLowerCase();
  const alreadyHasUnit = UNIT_SUFFIXES.some((u) => lower.endsWith(u));
  if (alreadyHasUnit) return trimmed;

  const u = (unit && String(unit).trim()) || 'sqft';
  return `${trimmed} ${u}`;
}

/**
 * Price/text value, or '' when it is nullish, 0, or the same placeholder blanks
 * cleanAreaText rejects. Lets a money line be dropped with .filter(Boolean)
 * instead of printing 'undefined' / '0'.
 */
export function priceOrEmpty(value?: string | number | null): string {
  if (value == null || value === 0) return '';
  const trimmed = String(value).trim();
  if (BLANK_AREA.has(trimmed.toLowerCase())) return '';
  return trimmed;
}
