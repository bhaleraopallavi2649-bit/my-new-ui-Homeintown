/**
 * WhatsApp link helpers.
 *
 * Four screens built their own `https://wa.me/...` URL. The AI match card and
 * group-info member row added the 91 country code to a bare 10-digit number,
 * but the CRM lead drawer and the lead-course "WhatsApp bhejo" button only
 * stripped non-digits, so a lead saved as "98765 43210" opened wa.me/9876543210
 * — WhatsApp reads that as an unknown international number. One helper keeps
 * the normalisation identical everywhere.
 */

/** Digits only; a bare 10-digit Indian mobile gets the `91` prefix. Longer
 *  numbers are assumed to already carry a country code and pass through. */
export function waDigits(phone?: string): string {
  const d = String(phone || '').replace(/[^0-9]/g, '');
  return d.length === 10 ? `91${d}` : d;
}

/** `https://wa.me/<digits>` plus an optional pre-filled, URL-encoded message. */
export function waUrl(phone?: string, text?: string): string {
  const base = `https://wa.me/${waDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
