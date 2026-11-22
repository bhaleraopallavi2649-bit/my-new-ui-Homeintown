// jest does not transform node_modules, so the Expo modules are mocked.
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///tmp/print-uuid.pdf' })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(async () => undefined),
  moveAsync: jest.fn(async () => undefined),
}));

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import type { Quotation } from '../api';
import { buildQuotationHtml, escapeHtml, quotationFileName, shareQuotationPdf } from '../quotationPdf';

function makeQuotation(over: Partial<Quotation> = {}): Quotation {
  return {
    id: 'q1',
    number: 'HIT-Q-2026-0001',
    project: 'p1',
    createdBy: 'u1',
    projectSnapshot: { projectName: 'Balaji Heights', city: 'Nagpur', location: 'Wardha Road', reraNumber: 'P50500012345', builderName: 'Balaji Builders' },
    unit: { unitId: 'f1', label: 'A-302', tower: 'A', floor: 3, bhk: '2BHK' },
    buyer: { name: 'Amit Patil', phone: '9876543210' },
    sender: { name: 'Rahul Sharma', phone: '9123456789', email: 'r@x.in', companyName: 'HIT Realty', designation: 'Sales', logoUrl: null },
    inputs: { carpetSqFt: 1000, carpetSource: 'unit', ratePerSqFt: 5000, applyPlc: true, discount: 100000 },
    lines: [
      { key: 'base', label: 'Basic cost (1000 sq.ft × ₹5000)', amount: 5000000 },
      { key: 'parking', label: 'Parking', amount: 725000 },
      { key: 'discount', label: 'Discount', amount: -100000 },
    ],
    taxes: [
      { key: 'gst', label: 'GST (5%)', amount: 281250 },
      { key: 'stampDuty', label: 'Stamp duty (6%)', amount: 337500 },
      { key: 'registration', label: 'Registration', amount: 30000 },
    ],
    totals: { gross: 5725000, discount: 100000, agreementValue: 5625000, gst: 281250, stampDuty: 337500, registration: 30000, maintenance: 0, grandTotal: 6273750 },
    notes: ['TDS @1% (Sec 194-IA) is deducted by the buyer.'],
    paymentPlan: '10% on booking\n90% on possession',
    remarks: null,
    termsText: null,
    bankDetails: null,
    validUntil: '2026-11-14T06:00:00Z',
    status: 'sent',
    effectiveStatus: 'sent',
    createdAt: '2026-10-30T06:00:00Z',
    ...over,
  };
}

describe('buildQuotationHtml', () => {
  it('has the number, agreement value and RERA', () => {
    const html = buildQuotationHtml(makeQuotation());
    expect(html).toContain('HIT-Q-2026-0001');
    expect(html).toContain('₹56,25,000');
    expect(html).toContain('RERA: P50500012345');
    expect(html).toContain('10% on booking<br/>90% on possession');
  });

  it('prints a Discount row only when totals.discount > 0', () => {
    const withDiscount = buildQuotationHtml(makeQuotation());
    expect(withDiscount).toContain('<td>Discount</td>');
    expect(withDiscount).toContain('-₹1,00,000');

    const noDiscount = buildQuotationHtml(makeQuotation({
      lines: [{ key: 'base', label: 'Basic cost', amount: 5000000 }],
      totals: { gross: 5000000, discount: 0, agreementValue: 5000000, gst: 0, stampDuty: 0, registration: 0, maintenance: 0, grandTotal: 5000000 },
    }));
    expect(noDiscount).not.toContain('Discount');
  });

  it('escapes user strings', () => {
    const html = buildQuotationHtml(makeQuotation({ buyer: { name: '<script>alert(1)</script>', phone: null } }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`a&b"'`)).toBe('a&amp;b&quot;&#39;');
  });

  it('drops a non-http logo URL and keeps an https one', () => {
    const bad = buildQuotationHtml(makeQuotation({ sender: { ...makeQuotation().sender, logoUrl: 'javascript:alert(1)' } }));
    expect(bad).not.toContain('<img');
    const good = buildQuotationHtml(makeQuotation({ sender: { ...makeQuotation().sender, logoUrl: 'https://cdn.example.com/l.png' } }));
    expect(good).toContain('<img class="logo" src="https://cdn.example.com/l.png"');
  });
});

describe('shareQuotationPdf', () => {
  it('renames into the cache and shares as application/pdf', async () => {
    const uri = await shareQuotationPdf(makeQuotation());
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining('HIT-Q-2026-0001') });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/Quotation-HIT-Q-2026-0001.pdf', { idempotent: true });
    expect(FileSystem.moveAsync).toHaveBeenCalledWith({ from: 'file:///tmp/print-uuid.pdf', to: 'file:///cache/Quotation-HIT-Q-2026-0001.pdf' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/Quotation-HIT-Q-2026-0001.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
    expect(uri).toBe('file:///cache/Quotation-HIT-Q-2026-0001.pdf');
  });

  it('file name replaces unsafe characters', () => {
    expect(quotationFileName({ number: 'HIT/Q 1' })).toBe('Quotation-HIT_Q_1.pdf');
  });
});
