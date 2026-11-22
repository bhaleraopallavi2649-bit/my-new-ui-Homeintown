import type { CreateQuotationInput } from '../api';
import { buildCreateBody, CreateBodyInput, discountFromInput } from '../quotationForm';

const base: CreateBodyInput = {
  projectId: 'p1',
  unit: null,
  bhk: '2 BHK',
  unitLabel: '',
  floor: null,
  built: { overrides: {} },
  projectCarpetSqFt: 700,
  applyPlc: false,
  discount: discountFromInput(''),
  paymentPlan: '',
  remarks: '',
  buyerName: 'Ravi',
  buyerPhone: '',
  canEditSettings: false,
  saveSwitch: true,
};
const make = (p: Partial<CreateBodyInput>) => buildCreateBody({ ...base, ...p });

// Verbatim copy of the inline onCreate body from quotation-new.tsx at 4cbee92,
// so the extraction is checked against the old code byte for byte (JSON key
// order included), not only against the rules as restated in the tests below.
function legacyBody(i: CreateBodyInput): CreateQuotationInput {
  const r = { unit: i.unit, carpet: { sqft: i.projectCarpetSqFt } };
  const built = i.built;
  const { projectId, buyerName, buyerPhone, bhk, unitLabel, remarks, discount } = i;
  const floorNum = i.floor;
  const plcShown = true;
  const applyPlc = i.applyPlc;
  const form = { paymentPlan: i.paymentPlan ?? undefined };
  const saveToProject = i.canEditSettings && i.saveSwitch;
  const body: CreateQuotationInput = { projectId, buyer: { name: buyerName.trim() } };
  if (buyerPhone.trim()) body.buyer.phone = buyerPhone.trim();
  if (r.unit) {
    body.unitId = r.unit.id;
  } else {
    if (bhk.trim()) body.bhk = bhk.trim();
    if (unitLabel.trim()) body.unitLabel = unitLabel.trim();
    if (floorNum !== null) body.floor = floorNum;
  }
  if (built.carpetSqFt !== undefined && built.carpetSqFt !== r.carpet?.sqft) body.carpetSqFt = built.carpetSqFt;
  if (plcShown && applyPlc) body.applyPlc = true;
  if (discount.ok && discount.value !== null) body.discount = discount.value;
  const plan = (form.paymentPlan || '').trim();
  if (plan) body.paymentPlan = plan;
  if (remarks.trim()) body.remarks = remarks.trim();
  const hasOverrides = Object.keys(built.overrides).length > 0;
  if (hasOverrides) body.overrides = built.overrides;
  if (saveToProject && (hasOverrides || body.carpetSqFt !== undefined)) body.saveToProject = true;
  return body;
}

describe('buildCreateBody', () => {
  it('minimal BHK body', () => {
    expect(make({})).toEqual({ projectId: 'p1', buyer: { name: 'Ravi' }, bhk: '2 BHK' });
  });

  it('trims buyer name / phone, omits a blank phone', () => {
    expect(make({ buyerName: '  Ravi ', buyerPhone: ' +91 98765 43210 ' }).buyer).toEqual({ name: 'Ravi', phone: '+91 98765 43210' });
    expect(make({ buyerPhone: '   ' }).buyer).toEqual({ name: 'Ravi' });
  });

  describe('discount (2=b)', () => {
    it('blank → no key', () => {
      expect('discount' in make({ discount: discountFromInput('') })).toBe(false);
      expect('discount' in make({ discount: discountFromInput('   ') })).toBe(false);
    });
    it('0 → no key', () => {
      expect('discount' in make({ discount: discountFromInput('0') })).toBe(false);
    });
    it('positive → sent', () => {
      expect(make({ discount: discountFromInput('₹50,000') }).discount).toBe(50000);
    });
    it('invalid → not sent (the Next button is disabled for it anyway)', () => {
      expect('discount' in make({ discount: discountFromInput('-5') })).toBe(false);
    });
  });

  describe('saveToProject', () => {
    const ov = { built: { overrides: { gstPercent: 5 } } };
    it('editor with the switch on and an override → true', () => {
      expect(make({ ...ov, canEditSettings: true, saveSwitch: true }).saveToProject).toBe(true);
    });
    it('non-editor never sends it, even with the switch on', () => {
      expect('saveToProject' in make({ ...ov, canEditSettings: false, saveSwitch: true })).toBe(false);
    });
    it('editor with the switch off → no key', () => {
      expect('saveToProject' in make({ ...ov, canEditSettings: true, saveSwitch: false })).toBe(false);
    });
    it('editor, nothing to save (no overrides, no typed carpet) → no key', () => {
      expect('saveToProject' in make({ canEditSettings: true, saveSwitch: true })).toBe(false);
    });
    it('editor, only a typed carpet → true', () => {
      const b = make({ canEditSettings: true, built: { overrides: {}, carpetSqFt: 820 } });
      expect(b.carpetSqFt).toBe(820);
      expect(b.saveToProject).toBe(true);
    });
  });

  describe('carpet', () => {
    it('same as the project carpet (prefilled) → not re-sent', () => {
      const b = make({ canEditSettings: true, built: { overrides: {}, carpetSqFt: 700 }, projectCarpetSqFt: 700 });
      expect('carpetSqFt' in b).toBe(false);
      expect('saveToProject' in b).toBe(false);
    });
    it('typed, different from the project → sent', () => {
      expect(make({ built: { overrides: {}, carpetSqFt: 750 }, projectCarpetSqFt: 700 }).carpetSqFt).toBe(750);
    });
    it('typed, project has none → sent', () => {
      expect(make({ built: { overrides: {}, carpetSqFt: 750 }, projectCarpetSqFt: null }).carpetSqFt).toBe(750);
    });
    it('cleared box → omitted, the server falls back to the default', () => {
      expect('carpetSqFt' in make({ built: { overrides: {} } })).toBe(false);
    });
  });

  describe('flat path vs BHK path', () => {
    it('flat: only unitId; bhk, unitLabel and floor are not sent', () => {
      const b = make({ unit: { id: 'u1' }, bhk: '2 BHK', unitLabel: 'A-502', floor: 5 });
      expect(b.unitId).toBe('u1');
      expect('bhk' in b || 'unitLabel' in b || 'floor' in b).toBe(false);
    });
    it('BHK: bhk, unitLabel and floor (trimmed), floor 0 kept', () => {
      expect(make({ bhk: ' 3BHK ', unitLabel: ' B-1 ', floor: 0 })).toEqual({
        projectId: 'p1', buyer: { name: 'Ravi' }, bhk: '3BHK', unitLabel: 'B-1', floor: 0,
      });
    });
    it('BHK: blank floor → no key', () => {
      expect('floor' in make({ floor: null })).toBe(false);
    });
  });

  it('applyPlc, plan, remarks, overrides', () => {
    const b = make({ applyPlc: true, paymentPlan: ' 10% booking ', remarks: ' hi ', built: { overrides: { ratePerSqFt: 6000 } } });
    expect(b.applyPlc).toBe(true);
    expect(b.paymentPlan).toBe('10% booking');
    expect(b.remarks).toBe('hi');
    expect(b.overrides).toEqual({ ratePerSqFt: 6000 });
    const blank = make({ paymentPlan: '  ', remarks: ' ' });
    expect('applyPlc' in blank || 'paymentPlan' in blank || 'remarks' in blank || 'overrides' in blank).toBe(false);
  });

  it('matches the old inline onCreate body byte for byte on every path', () => {
    const units = [null, { id: 'u1' }];
    const discounts = ['', '0', '2500', '-1'];
    const carpets: (number | undefined)[] = [undefined, 700, 820];
    const projectCarpets = [700, null];
    const overrideSets = [{}, { gstPercent: 5, termsText: 'T' }];
    let n = 0;
    for (const unit of units) for (const d of discounts) for (const carpetSqFt of carpets) for (const projectCarpetSqFt of projectCarpets)
      for (const overrides of overrideSets) for (const canEditSettings of [true, false]) for (const saveSwitch of [true, false])
        for (const floor of [null, 0, 7]) for (const applyPlc of [true, false]) {
          const input: CreateBodyInput = {
            ...base, unit, floor, applyPlc, canEditSettings, saveSwitch, projectCarpetSqFt,
            discount: discountFromInput(d),
            built: carpetSqFt === undefined ? { overrides } : { overrides, carpetSqFt },
            unitLabel: n % 2 ? ' A-1 ' : '',
            paymentPlan: n % 3 ? ' plan ' : undefined,
            remarks: n % 5 ? '' : ' r ',
            buyerPhone: n % 2 ? '' : ' 9876543210 ',
          };
          expect(JSON.stringify(buildCreateBody(input))).toBe(JSON.stringify(legacyBody(input)));
          n++;
        }
    expect(n).toBe(2 * 4 * 3 * 2 * 2 * 2 * 2 * 3 * 2);
  });
});
