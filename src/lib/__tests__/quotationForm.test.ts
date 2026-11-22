import type { QuotationSettings } from '../api';
import {
  buildOverrides,
  discountFromInput,
  effectiveSettings,
  isValidBuyerPhone,
  normBhk,
  parseNumberInput,
  requiredStillMissing,
} from '../quotationForm';

const base: QuotationSettings = {
  ratePerSqFt: 5000,
  gstPercent: 5,
  stampDutyPercent: 6,
  registrationCharge: 30000,
  floorRise: { perSqFt: 50, fromFloor: 3 },
  otherCharges: [],
  carpetAreaByBhk: [{ bhk: '1BHK', sqft: 450 }, { bhk: '2 bhk', sqft: 700 }, { bhk: '3BHK', sqft: 1000 }],
  defaultPaymentPlan: null,
  validityDays: 15,
};

describe('parseNumberInput', () => {
  it('blank → null; strips , spaces ₹', () => {
    expect(parseNumberInput('')).toEqual({ ok: true, value: null });
    expect(parseNumberInput('   ')).toEqual({ ok: true, value: null });
    expect(parseNumberInput('₹ 1,00,000')).toEqual({ ok: true, value: 100000 });
    expect(parseNumberInput('12.5')).toEqual({ ok: true, value: 12.5 });
  });

  it('junk is not a number', () => {
    expect(parseNumberInput('abc')).toEqual({ ok: false });
    expect(parseNumberInput('0x10')).toEqual({ ok: false });
  });
});

describe('discountFromInput (2=b: discount box may stay empty)', () => {
  it("'' and '0' mean no discount", () => {
    expect(discountFromInput('')).toEqual({ ok: true, value: null });
    expect(discountFromInput('0')).toEqual({ ok: true, value: null });
  });

  it("'₹1,00,000' parses", () => {
    expect(discountFromInput('₹1,00,000')).toEqual({ ok: true, value: 100000 });
  });

  it("'-5' is an error", () => {
    expect(discountFromInput('-5')).toEqual({ ok: false, error: 'Discount 0 ya usse zyada hona chahiye' });
  });
});

describe('buildOverrides', () => {
  it('blank fields are omitted, never null (null would clear the project value)', () => {
    const out = buildOverrides({ ratePerSqFt: '', gstPercent: '  ', parkingCharge: '200000', termsText: '' }, { settings: base, saveToProject: true });
    expect(out.errors).toEqual({});
    expect(out.overrides).toEqual({ parkingCharge: 200000 });
    expect(Object.values(out.overrides)).not.toContain(null);
    expect(out.carpetSqFt).toBeUndefined();
  });

  it('out-of-bounds GST 40 is an error and is not sent', () => {
    const out = buildOverrides({ gstPercent: '40' }, { settings: base, saveToProject: false });
    expect(out.errors.gstPercent).toBeTruthy();
    expect(out.overrides.gstPercent).toBeUndefined();
  });

  it('BHK path + save: carpetAreaByBhk keeps the other BHKs and replaces "2 bhk" for 2BHK', () => {
    const out = buildOverrides({ carpetSqFt: '720' }, { settings: base, bhk: '2BHK', saveToProject: true });
    expect(out.carpetSqFt).toBe(720);
    expect(out.overrides.carpetAreaByBhk).toEqual([{ bhk: '1BHK', sqft: 450 }, { bhk: '2 bhk', sqft: 720 }, { bhk: '3BHK', sqft: 1000 }]);
  });

  it('BHK path without save: carpet is top-level only', () => {
    const out = buildOverrides({ carpetSqFt: '720' }, { settings: base, bhk: '2BHK', saveToProject: false });
    expect(out.carpetSqFt).toBe(720);
    expect(out.overrides.carpetAreaByBhk).toBeUndefined();
  });

  it('flat path never sends carpetAreaByBhk (the backend stores the flat override)', () => {
    const out = buildOverrides({ carpetSqFt: '735' }, { settings: base, unitId: 'u1', bhk: '2BHK', saveToProject: true });
    expect(out.carpetSqFt).toBe(735);
    expect(out.overrides.carpetAreaByBhk).toBeUndefined();
  });

  it('carpet 0 is an error (must be > 0)', () => {
    const out = buildOverrides({ carpetSqFt: '0' }, { settings: base, saveToProject: false });
    expect(out.errors.carpetSqFt).toBeTruthy();
    expect(out.carpetSqFt).toBeUndefined();
  });

  it('typing only one floor-rise half keeps the stored other half', () => {
    const out = buildOverrides({ floorRiseFromFloor: '4' }, { settings: base, saveToProject: true });
    expect(out.overrides.floorRise).toEqual({ perSqFt: 50, fromFloor: 4 });
  });

  it('payment plan becomes the project default only when saving and none exists', () => {
    expect(buildOverrides({ paymentPlan: 'CLP 10/90' }, { settings: base, saveToProject: true }).overrides.defaultPaymentPlan).toBe('CLP 10/90');
    expect(buildOverrides({ paymentPlan: 'CLP 10/90' }, { settings: base, saveToProject: false }).overrides.defaultPaymentPlan).toBeUndefined();
    expect(buildOverrides({ paymentPlan: 'CLP 10/90' }, { settings: { ...base, defaultPaymentPlan: 'Old' }, saveToProject: true }).overrides.defaultPaymentPlan).toBeUndefined();
  });
});

describe('effectiveSettings mirrors backend mergeSettings', () => {
  it('lists replace, nested objects merge, null deletes', () => {
    const m = effectiveSettings(
      { floorRise: { perSqFt: 50, fromFloor: 3 }, otherCharges: [{ label: 'a', amount: 1 }], parkingCharge: 5 },
      { floorRise: { fromFloor: 4 } as any, otherCharges: [], parkingCharge: null },
    );
    expect(m).toEqual({ floorRise: { perSqFt: 50, fromFloor: 4 }, otherCharges: [] });
  });
});

describe('requiredStillMissing', () => {
  it('gstPercent 0 counts as present; order is the wizard order', () => {
    const all = ['ratePerSqFt', 'carpetSqFt', 'gstPercent', 'stampDutyPercent', 'registrationCharge'] as const;
    expect(requiredStillMissing(all, { gstPercent: 0 }, null)).toEqual(['ratePerSqFt', 'carpetSqFt', 'stampDutyPercent', 'registrationCharge']);
    expect(requiredStillMissing(all, { ratePerSqFt: 1, gstPercent: 5, stampDutyPercent: 6, registrationCharge: 0 }, 700)).toEqual([]);
  });

  it('only checks the keys it was given', () => {
    expect(requiredStillMissing(['gstPercent'], {}, null)).toEqual(['gstPercent']);
  });
});

describe('small helpers', () => {
  it('normBhk', () => {
    expect(normBhk('2 bhk')).toBe('2BHK');
    expect(normBhk(null)).toBe('');
  });

  it('isValidBuyerPhone uses the backend regex', () => {
    expect(isValidBuyerPhone('+91 98765-43210')).toBe(true);
    expect(isValidBuyerPhone('9876543210')).toBe(true);
    expect(isValidBuyerPhone('12345')).toBe(false);
    expect(isValidBuyerPhone('abc1234567')).toBe(false);
  });
});
