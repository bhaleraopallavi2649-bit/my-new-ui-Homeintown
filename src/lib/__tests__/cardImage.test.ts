// jest does not transform node_modules, so the native modules are mocked.
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/card.png') }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async () => undefined),
}));

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import type { VisitingCardData } from '../api';
import { buildVCard, publicCardUrl, shareCardPng, shareVCard, vcardEscape } from '../cardImage';

function makeCard(over: Partial<VisitingCardData> = {}): VisitingCardData {
  return {
    code: 'rahul-sharma-k7m2q',
    published: false,
    template: 'classic',
    name: 'Rahul Sharma',
    phone: '+919123456789',
    email: 'rahul@example.com',
    companyName: 'HIT Realty',
    designation: 'Sales Head',
    website: 'https://hitrealty.in/',
    reraAgentNo: 'A51900012345',
    social: { instagram: null, facebook: null, youtube: null },
    photoUrl: null,
    logoUrl: null,
    address: { line: 'Plot 4, Wardha Road', city: 'Nagpur', state: 'Maharashtra', pinCode: '440015' },
    verified: true,
    role: 'agent',
    ...over,
  };
}

describe('vcardEscape', () => {
  it('escapes backslash first, then , ; and newlines', () => {
    expect(vcardEscape('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(vcardEscape('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3');
  });
});

describe('buildVCard', () => {
  it('is vCard 3.0 with CRLF everywhere', () => {
    const v = buildVCard(makeCard());
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(v.endsWith('END:VCARD\r\n')).toBe(true);
    expect(v.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('splits the name as family = last word', () => {
    const v = buildVCard(makeCard());
    expect(v).toContain('\r\nN:Sharma;Rahul;;;\r\n');
    expect(v).toContain('\r\nFN:Rahul Sharma\r\n');
    expect(v).toContain('\r\nORG:HIT Realty\r\n');
    expect(v).toContain('\r\nTITLE:Sales Head\r\n');
    expect(v).toContain('\r\nTEL;TYPE=CELL:+919123456789\r\n');
    expect(v).toContain('\r\nEMAIL;TYPE=INTERNET:rahul@example.com\r\n');
    expect(v).toContain('\r\nNOTE:RERA Agent No: A51900012345\r\n');
  });

  it('escapes each ADR component but not the separators; multi-line address', () => {
    const v = buildVCard(makeCard({ address: { line: 'Plot 4, Wardha Road\nNear Metro', city: 'Nagpur', state: 'Maharashtra', pinCode: '440015' } }));
    expect(v).toContain('\r\nADR;TYPE=WORK:;;Plot 4\\, Wardha Road\\nNear Metro;Nagpur;Maharashtra;440015;India\r\n');
  });

  it('omits empty fields', () => {
    const v = buildVCard(makeCard({ email: null, companyName: '', designation: null, website: null, reraAgentNo: null, address: { line: null, city: null, state: null, pinCode: null } }));
    expect(v).not.toMatch(/EMAIL|ORG|TITLE|URL|ADR|NOTE/);
  });

  it('adds the public URL only when passed', () => {
    expect(buildVCard(makeCard())).not.toContain('homeintown.in');
    const v = buildVCard(makeCard(), { publicUrl: publicCardUrl('rahul-sharma-k7m2q') });
    expect(v).toContain('\r\nURL:https://homeintown.in/card/rahul-sharma-k7m2q\r\n');
  });
});

describe('publicCardUrl', () => {
  it('points at homeintown.in/card/<code>', () => {
    expect(publicCardUrl('rahul-sharma-k7m2q')).toBe('https://homeintown.in/card/rahul-sharma-k7m2q');
  });
});

describe('sharing', () => {
  it('shareVCard writes <name>.vcf and shares as text/x-vcard', async () => {
    const uri = await shareVCard(makeCard({ published: true }));
    expect(uri).toBe('file:///cache/rahul-sharma.vcf');
    const [path, body, opts] = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(path).toBe('file:///cache/rahul-sharma.vcf');
    expect(body).toContain('URL:https://homeintown.in/card/rahul-sharma-k7m2q');
    expect(opts).toEqual({ encoding: 'utf8' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/rahul-sharma.vcf', expect.objectContaining({ mimeType: 'text/x-vcard' }));
  });

  it('shareCardPng captures a png tmpfile and shares it', async () => {
    const ref = { current: {} } as any;
    expect(await shareCardPng(ref)).toBe('file:///tmp/card.png');
    expect(captureRef).toHaveBeenCalledWith(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/card.png', expect.objectContaining({ mimeType: 'image/png' }));
  });
});
