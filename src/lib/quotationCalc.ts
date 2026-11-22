// Flat quotation (cost sheet) maths — a line-for-line TypeScript port of
// HIT_Backend services/QuotationCalculator.js (be5a995).
//
// PREVIEW ONLY. The wizard uses this to show a live total while the user
// types; the quotation that is saved, listed and printed is always the one the
// server calculated. If a rule changes in the backend file, change it here and
// in both test files (backend tests/quotationCalculator.test.js and
// src/lib/__tests__/quotationCalc.test.ts), or the preview and the PDF will
// disagree.
//
// Rules (rates are always per project, never hardcoded — Indian GST / stamp
// duty differ by state, project type and construction stage):
//   base         = carpetSqFt × ratePerSqFt
//   floorRise    = floorsCharged × floorRise.perSqFt × carpetSqFt,
//                  floorsCharged = max(0, floor − fromFloor + 1)
//   plc          = plcPerSqFt × carpetSqFt, only when applyPlc
//   parking, club, each otherCharges[] = fixed amounts
//   discount     = optional fixed amount, taken off BEFORE taxes; never below 0
//   agreementValue = base + floorRise + plc + parking + club + others − discount
//   gst          = agreementValue × gstPercent / 100
//   stampDuty    = agreementValue × stampDutyPercent / 100
//   registration = fixed amount
//   maintenance  = maintenance.perSqFt × carpetSqFt × months (shown separately)
//   grandTotal   = agreementValue + gst + stampDuty + registration + maintenance
// Every line is rounded to the rupee. TDS (Sec 194-IA, 1% when the value is
// ₹50 lakh or more) is deducted by the buyer, so it is a note, not a line.
//
// No React Native / Expo import, so it runs under jest's node environment.

export const TDS_THRESHOLD = 5000000;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r = (v: number) => Math.round(v);

export interface QuotationCalcSettings {
  floorRise?: { perSqFt?: number | null; fromFloor?: number | null } | null;
  plcPerSqFt?: number | null;
  parkingCharge?: number | null;
  clubCharge?: number | null;
  otherCharges?: { label: string; amount: number }[] | null;
  gstPercent?: number | null;
  stampDutyPercent?: number | null;
  registrationCharge?: number | null;
  maintenance?: { perSqFt?: number | null; months?: number | null } | null;
}

export interface QuotationCalcInput {
  carpetSqFt: number | null | undefined;
  ratePerSqFt: number | null | undefined;
  floor?: number | null;
  applyPlc?: boolean;
  discount?: number | null;
  settings?: QuotationCalcSettings | null;
}

export interface QuotationCalcLine {
  key: string;
  label: string;
  amount: number;
}

export interface QuotationCalcResult {
  lines: QuotationCalcLine[];
  taxes: QuotationCalcLine[];
  totals: {
    gross: number;
    discount: number;
    agreementValue: number;
    gst: number;
    stampDuty: number;
    registration: number;
    maintenance: number;
    grandTotal: number;
  };
  notes: string[];
}

export function calculateQuotation({
  carpetSqFt,
  ratePerSqFt,
  floor = null,
  applyPlc = false,
  discount = null,
  settings = {},
}: QuotationCalcInput): QuotationCalcResult {
  const area = num(carpetSqFt);
  const rate = num(ratePerSqFt);
  if (!area || area <= 0) throw Object.assign(new Error('carpetSqFt must be a positive number'), { code: 'INVALID_INPUT' });
  if (rate === null || rate <= 0) throw Object.assign(new Error('ratePerSqFt must be a positive number'), { code: 'INVALID_INPUT' });

  const s: QuotationCalcSettings = settings || {};
  const lines: QuotationCalcLine[] = [];
  const add = (key: string, label: string, amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return;
    lines.push({ key, label, amount: r(amount) });
  };

  add('base', `Basic cost (${area} sq.ft × ₹${rate})`, area * rate);

  const fr = s.floorRise || {};
  const frPerSqFt = num(fr.perSqFt);
  const fl = num(floor);
  if (frPerSqFt && fl !== null) {
    const from = num(fr.fromFloor) ?? 1;
    const floors = Math.max(0, fl - from + 1);
    if (floors > 0) add('floorRise', `Floor rise (${floors} floor${floors > 1 ? 's' : ''} × ₹${frPerSqFt}/sq.ft)`, floors * frPerSqFt * area);
  }
  const plc = num(s.plcPerSqFt);
  if (applyPlc && plc) add('plc', `Preferred location (₹${plc}/sq.ft)`, plc * area);
  const parking = num(s.parkingCharge);
  if (parking) add('parking', 'Parking', parking);
  const club = num(s.clubCharge);
  if (club) add('club', 'Club house / amenities', club);
  for (const oc of s.otherCharges || []) {
    if (oc && oc.label && num(oc.amount)) add('other', oc.label, oc.amount);
  }

  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  const d = num(discount);
  // Discount is optional (blank box = no line at all, not a ₹0 line).
  const discountAmount = d && d > 0 ? Math.min(r(d), gross) : 0;
  if (discountAmount > 0) lines.push({ key: 'discount', label: 'Discount', amount: -discountAmount });

  const agreementValue = gross - discountAmount;
  const gstPercent = num(s.gstPercent) ?? 0;
  const stampPercent = num(s.stampDutyPercent) ?? 0;
  const gst = r((agreementValue * gstPercent) / 100);
  const stampDuty = r((agreementValue * stampPercent) / 100);
  const registration = r(num(s.registrationCharge) ?? 0);
  const m = s.maintenance || {};
  const mPerSqFt = num(m.perSqFt);
  const mMonths = num(m.months);
  const maintenance = mPerSqFt && mMonths ? r(mPerSqFt * area * mMonths) : 0;

  const taxes: QuotationCalcLine[] = [
    { key: 'gst', label: `GST (${gstPercent}%)`, amount: gst },
    { key: 'stampDuty', label: `Stamp duty (${stampPercent}%)`, amount: stampDuty },
    { key: 'registration', label: 'Registration', amount: registration },
  ];
  if (maintenance > 0) taxes.push({ key: 'maintenance', label: `Maintenance (${mMonths} months × ₹${mPerSqFt}/sq.ft)`, amount: maintenance });

  const grandTotal = agreementValue + gst + stampDuty + registration + maintenance;
  const notes: string[] = [];
  if (agreementValue >= TDS_THRESHOLD) notes.push('TDS @1% (Sec 194-IA) is deducted by the buyer and paid to the government; it is part of, not in addition to, the agreement value.');

  return {
    lines,
    taxes,
    totals: { gross, discount: discountAmount, agreementValue, gst, stampDuty, registration, maintenance, grandTotal },
    notes,
  };
}
