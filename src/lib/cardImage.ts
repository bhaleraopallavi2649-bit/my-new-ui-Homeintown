// Visiting card sharing: the public link, a vCard (.vcf) contact file, and a
// PNG snapshot of the on-screen card.
//
// The public card page is on homeintown.in (HIT_Frontend), not
// sales.homeintown.in: the two are separate sites, and buyers open the
// customer-facing one.
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import type { VisitingCardData } from './api';

export const PUBLIC_CARD_ORIGIN = 'https://homeintown.in';

export function publicCardUrl(code: string): string {
  return `${PUBLIC_CARD_ORIGIN}/card/${encodeURIComponent(code)}`;
}

/**
 * vCard 3.0 text escaping (RFC 2426 §4): backslash first, or the escapes
 * added for , and ; would themselves be doubled.
 */
export function vcardEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r\n|\n|\r/g, '\\n');
}

const clean = (v: string | null | undefined) => String(v ?? '').trim();

/**
 * vCard 3.0 with CRLF line endings. Lines with no value are left out. Long
 * lines are not folded: folding is optional in 3.0 and the Android and iOS
 * contact importers accept long lines. Components of N and ADR are escaped one
 * by one; the `;` between them are separators and stay unescaped.
 */
export function buildVCard(card: VisitingCardData, opts?: { publicUrl?: string }): string {
  const name = clean(card.name);
  const parts = name.split(/\s+/).filter(Boolean);
  // Indian names: last word as the family name, the rest as given names.
  const family = parts.length > 1 ? parts[parts.length - 1] : '';
  const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '';

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  const add = (prop: string, value: string | null | undefined) => {
    const v = clean(value);
    if (v) lines.push(`${prop}:${vcardEscape(v)}`);
  };

  if (name) {
    lines.push(`N:${vcardEscape(family)};${vcardEscape(given)};;;`);
    lines.push(`FN:${vcardEscape(name)}`);
  }
  add('ORG', card.companyName);
  add('TITLE', card.designation);
  add('TEL;TYPE=CELL', card.phone);
  add('EMAIL;TYPE=INTERNET', card.email);
  add('URL', card.website);
  if (opts?.publicUrl) add('URL', opts.publicUrl);

  const a = card.address || ({} as VisitingCardData['address']);
  const adr = [a.line, a.city, a.state, a.pinCode].map(clean);
  if (adr.some(Boolean)) lines.push(`ADR;TYPE=WORK:;;${adr.map(vcardEscape).join(';')};India`);

  if (clean(card.reraAgentNo)) add('NOTE', `RERA Agent No: ${clean(card.reraAgentNo)}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

function fileSlug(name: string | null | undefined): string {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Write <name>.vcf to the cache and open the share sheet. The public link is
 * only included once the card is published, so the contact never points at a
 * page that answers 404.
 */
export async function shareVCard(card: VisitingCardData): Promise<string> {
  const publicUrl = card.published && card.code ? publicCardUrl(card.code) : undefined;
  const uri = `${FileSystem.cacheDirectory}${fileSlug(card.name) || 'contact'}.vcf`;
  await FileSystem.writeAsStringAsync(uri, buildVCard(card, { publicUrl }), { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType: 'text/x-vcard', UTI: 'public.vcard', dialogTitle: 'Save contact' });
  return uri;
}

/**
 * Snapshot the on-screen card as a PNG and share it. On Android the captured
 * View needs collapsable={false}, or the native view is optimised away and
 * captureRef finds nothing to capture.
 */
export async function shareCardPng(ref: Parameters<typeof captureRef>[0]): Promise<string> {
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share visiting card' });
  return uri;
}
