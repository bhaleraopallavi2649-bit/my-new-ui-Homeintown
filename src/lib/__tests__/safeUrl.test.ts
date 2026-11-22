// P6-04: scheme allow-list for URLs that come from user data (group messages,
// attachments, project brochure/layout/video/maps links) before Linking.openURL.
import { isSafeHttpUrl, isSafeUrl } from '../safeUrl';

describe('isSafeHttpUrl', () => {
  it('accepts http and https web links', () => {
    expect(isSafeHttpUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
    expect(isSafeHttpUrl('HTTPS://EXAMPLE.COM/x?y=1#z')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isSafeHttpUrl('  https://x.com/a  ')).toBe(true);
  });

  it('rejects other schemes that would launch arbitrary apps or content', () => {
    for (const u of [
      'javascript:alert(1)',
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///sdcard/a.pdf',
      'content://com.android.contacts/contacts',
      'market://details?id=x',
      'tel:+911234567890',
      'whatsapp://send?text=hi',
      'data:text/html,<b>x</b>',
    ]) {
      expect(isSafeHttpUrl(u)).toBe(false);
    }
  });

  it('rejects empty, malformed and non-string input', () => {
    for (const u of ['', '   ', 'https://', 'https:example.com', 'example.com', '//example.com', null, undefined, 42, {}]) {
      expect(isSafeHttpUrl(u)).toBe(false);
    }
  });

  it('does not let a control-character prefix smuggle another scheme through', () => {
    expect(isSafeHttpUrl('\u0000javascript:alert(1)')).toBe(false);
  });
});

describe('isSafeUrl (default external allow-list)', () => {
  it('allows http/https/tel/mailto/whatsapp', () => {
    expect(isSafeUrl('https://wa.me/919876543210')).toBe(true);
    expect(isSafeUrl('tel:+919876543210')).toBe(true);
    expect(isSafeUrl('mailto:a@b.co')).toBe(true);
    expect(isSafeUrl('whatsapp://send?text=hi')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isSafeUrl('intent://x')).toBe(false);
    expect(isSafeUrl('javascript:void(0)')).toBe(false);
    expect(isSafeUrl('file:///x')).toBe(false);
  });

  it('honours a custom scheme list', () => {
    expect(isSafeUrl('tel:123', ['https'])).toBe(false);
    expect(isSafeUrl('https://x.com', ['https'])).toBe(true);
  });
});
