import { waDigits, waUrl } from '../phone';

describe('waDigits', () => {
  it('adds 91 to a bare 10-digit number with spaces', () => {
    expect(waDigits('98765 43210')).toBe('919876543210');
  });
  it('strips +91 formatting without doubling the prefix', () => {
    expect(waDigits('+91 98765 43210')).toBe('919876543210');
  });
  it('leaves a number that already has the country code alone', () => {
    expect(waDigits('919876543210')).toBe('919876543210');
  });
  it('handles empty / missing input', () => {
    expect(waDigits('')).toBe('');
    expect(waDigits(undefined)).toBe('');
  });
});

describe('waUrl', () => {
  it('returns the bare wa.me link for an empty number', () => {
    expect(waUrl('')).toBe('https://wa.me/');
  });
  it('builds the link without a text param when no text is given', () => {
    expect(waUrl('9876543210')).toBe('https://wa.me/919876543210');
  });
  it('URL-encodes the pre-filled text', () => {
    expect(waUrl('9876543210', 'a b&c')).toBe('https://wa.me/919876543210?text=a%20b%26c');
  });
});
