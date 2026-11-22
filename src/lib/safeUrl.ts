// Scheme allow-list for URLs that reach Linking.openURL from DATA rather than
// from code: group message text, attachment URLs, project brochure/layout/video
// links and the owner-typed Google Maps link.
//
// Why it exists (P6-04). Those strings are written by other users. The group
// socket path stores message `content` without validating it as a URL, and a
// project's googleMapLink / video links are free text on the web form. They
// were handed straight to Linking.openURL, which on Android fires an
// ACTION_VIEW intent for ANY scheme — so a member could post a link that opens
// an arbitrary installed app's deep link (market:, intent:, a banking app's
// custom scheme, file:/content: URIs) the moment someone tapped the bubble.
// Only web links are meant to be opened from these places.
//
// No react-native import, so it runs under jest's node environment.

/** Schemes that are safe to open from user-supplied data in general. */
export const SAFE_EXTERNAL_SCHEMES = ['http', 'https', 'tel', 'mailto', 'whatsapp'] as const;

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

/**
 * True when `u` is a non-empty string whose scheme is in `schemes`.
 *
 * The string is trimmed first (pasted links often carry whitespace), and for
 * http/https the remainder must look like a real `scheme://host` URL. Leading
 * control characters are not trimmed away silently: `trim()` only removes
 * whitespace, so a "\u0000javascript:" prefix still fails the scheme regex.
 */
export function isSafeUrl(u: unknown, schemes: readonly string[] = SAFE_EXTERNAL_SCHEMES): u is string {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  const m = SCHEME_RE.exec(s);
  if (!m) return false;
  const scheme = m[1].toLowerCase();
  if (!schemes.map((x) => x.toLowerCase()).includes(scheme)) return false;
  if (scheme === 'http' || scheme === 'https') {
    // Must have an authority: "https:foo" or "https://" alone is not a link.
    if (!/^https?:\/\/[^\s/?#]+/i.test(s)) return false;
    // Prefer the platform parser when present (Hermes and node both ship URL);
    // the regex above is the fallback.
    if (typeof URL === 'function') {
      try {
        // eslint-disable-next-line no-new
        new URL(s);
      } catch {
        return false;
      }
    }
  }
  return true;
}

/** True only for http(s) web links. Used for media / message / project links. */
export function isSafeHttpUrl(u: unknown): u is string {
  return isSafeUrl(u, ['http', 'https']);
}
