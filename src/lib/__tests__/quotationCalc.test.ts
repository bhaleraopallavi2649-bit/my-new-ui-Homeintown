// Same cases as HIT_Backend tests/quotationCalculator.test.js
// describe('calculateQuotation') at be5a995; keep them in sync. The app's live
// preview must agree with the server, which is what gets saved and printed.
import { calculateQuotation } from '../quotationCalc';

const full = {
  floorRise: { perSqFt: 50, fromFloor: 3 },
  plcPerSqFt: 100,
  parkingCharge: 300000,
  clubCharge: 150000,
  otherCharges: [{ label: 'Legal', amount: 25000 }],
  gstPercent: 5,
  stampDutyPercent: 6,
  registrationCharge: 30000,
  maintenance: { perSqFt: 3, months: 24 },
};

describe('calculateQuotation', () => {
  test('golden case: 1000 sq.ft × 5000, floor 5, PLC, discount 1L', () => {
    const out = calculateQuotation({ carpetSqFt: 1000, ratePerSqFt: 5000, floor: 5, applyPlc: true, discount: 100000, settings: full });
    // base 50,00,000; floor rise 3 floors × 50 × 1000 = 1,50,000; PLC 1,00,000;
    // parking 3,00,000; club 1,50,000; legal 25,000 → gross 57,25,000; − 1,00,000
    expect(out.totals).toEqual({
      gross: 5725000, discount: 100000, agreementValue: 5625000,
      gst: 281250, stampDuty: 337500, registration: 30000, maintenance: 72000,
      grandTotal: 5625000 + 281250 + 337500 + 30000 + 72000,
    });
    expect(out.lines.map((l) => l.key)).toEqual(['base', 'floorRise', 'plc', 'parking', 'club', 'other', 'discount']);
    expect(out.lines.find((l) => l.key === 'discount')!.amount).toBe(-100000);
    expect(out.notes).toHaveLength(1); // ≥ ₹50L → TDS note
  });

  test('blank discount adds no line; PLC off by default; below fromFloor → no floor rise', () => {
    const out = calculateQuotation({ carpetSqFt: 600, ratePerSqFt: 4000, floor: 2, discount: null, settings: full });
    const keys = out.lines.map((l) => l.key);
    expect(keys).not.toContain('discount');
    expect(keys).not.toContain('plc');
    expect(keys).not.toContain('floorRise');
    expect(out.totals.discount).toBe(0);
  });

  test('floor exactly fromFloor is charged once', () => {
    const out = calculateQuotation({ carpetSqFt: 100, ratePerSqFt: 1000, floor: 3, settings: { floorRise: { perSqFt: 10, fromFloor: 3 } } });
    expect(out.lines.find((l) => l.key === 'floorRise')!.amount).toBe(1000);
  });

  test('0% GST (ready to move) is valid, minimal settings', () => {
    const out = calculateQuotation({ carpetSqFt: 500, ratePerSqFt: 3000, settings: { gstPercent: 0, stampDutyPercent: 5, registrationCharge: 30000 } });
    expect(out.totals).toMatchObject({ agreementValue: 1500000, gst: 0, stampDuty: 75000, registration: 30000, maintenance: 0, grandTotal: 1605000 });
    expect(out.notes).toHaveLength(0);
    expect(out.taxes.map((t) => t.key)).toEqual(['gst', 'stampDuty', 'registration']);
  });

  test('discount never pushes value below 0; rounding to rupee', () => {
    const out = calculateQuotation({ carpetSqFt: 333.3, ratePerSqFt: 3333.33, discount: 1e12, settings: { gstPercent: 5 } });
    expect(out.totals.agreementValue).toBe(0);
    const r = calculateQuotation({ carpetSqFt: 333.3, ratePerSqFt: 3333.33, settings: { gstPercent: 5 } });
    expect(Number.isInteger(r.lines[0].amount)).toBe(true);
    expect(r.lines[0].amount).toBe(1110999); // 1,110,998.889 → 1,110,999
  });

  test('rejects missing area / rate', () => {
    expect(() => calculateQuotation({ carpetSqFt: 0, ratePerSqFt: 10 })).toThrow('carpetSqFt');
    expect(() => calculateQuotation({ carpetSqFt: 10, ratePerSqFt: null })).toThrow('ratePerSqFt');
  });
});
