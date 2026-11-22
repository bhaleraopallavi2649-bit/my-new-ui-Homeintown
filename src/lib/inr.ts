// Rupee and date formatting for the quotation screen and its PDF.
//
// Hand-written Indian grouping (12,34,56,789) instead of Intl /
// toLocaleString('en-IN'): Hermes and jest's node can ship different ICU data,
// and a missing locale silently falls back to Western grouping (1,234,567).
// The same function feeds the live preview and the PDF HTML, so both must
// print exactly the same string everywhere.
//
// No React Native / Expo import, so it runs under jest's node environment.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3);
  // Pairs from the right for everything before the last three digits.
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/**
 * Indian-grouped number without a symbol. Keeps up to 2 decimals (carpet
 * areas like 333.3 sq.ft), trailing zeros dropped. Non-finite → '0'.
 */
export function formatIndianNumber(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, frac] = fixed.split('.');
  const fracTrim = frac.replace(/0+$/, '');
  const out = groupIndian(intPart) + (fracTrim ? `.${fracTrim}` : '');
  return neg && out !== '0' ? `-${out}` : out;
}

/** ₹ amount rounded to the rupee: ₹56,25,000; negatives as -₹1,00,000. */
export function formatINR(n: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0;
  const body = groupIndian(String(Math.abs(v)));
  return v < 0 ? `-₹${body}` : `₹${body}`;
}

/** "14 Nov 2026" in the device's local time zone; '' for a missing/invalid date. */
export function formatDateIN(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
