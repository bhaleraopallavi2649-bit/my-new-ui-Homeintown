import { formatDateIN, formatINR, formatIndianNumber } from '../inr';

describe('formatINR (Indian grouping, no Intl)', () => {
  it.each([
    [0, '₹0'],
    [100, '₹100'],
    [1000, '₹1,000'],
    [100000, '₹1,00,000'],
    [5625000, '₹56,25,000'],
    [123456789, '₹12,34,56,789'],
    [-100000, '-₹1,00,000'],
    [1110998.889, '₹11,10,999'],
  ])('%p → %p', (n, out) => {
    expect(formatINR(n)).toBe(out);
  });

  it('non-finite input prints ₹0 instead of ₹NaN', () => {
    expect(formatINR(NaN)).toBe('₹0');
  });
});

describe('formatIndianNumber', () => {
  it('groups without a symbol and keeps up to 2 decimals', () => {
    expect(formatIndianNumber(1234567)).toBe('12,34,567');
    expect(formatIndianNumber(333.3)).toBe('333.3');
    expect(formatIndianNumber(1000)).toBe('1,000');
  });
});

describe('formatDateIN', () => {
  it('prints dd Mon yyyy', () => {
    expect(formatDateIN('2026-11-14T06:00:00Z')).toBe('14 Nov 2026');
  });

  it('missing or invalid dates print nothing', () => {
    expect(formatDateIN(null)).toBe('');
    expect(formatDateIN('not a date')).toBe('');
  });
});
