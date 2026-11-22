// Quotation wizard form helpers: number parsing, the backend's validation
// bounds, the discount-blank rule, and building the `overrides` body for
// POST /quotations. Mirrors HIT_Backend services/QuotationSettingsService.js
// (be5a995): sanitizeSettings bounds, mergeSettings, findMissing, normBhk.
//
// Two backend behaviours drive most of the rules here:
//  - mergeSettings DELETES a key whose override is null, so a blank field must
//    be omitted, never sent as null, or it wipes the project's value.
//  - mergeSettings REPLACES lists, so carpetAreaByBhk must carry the whole
//    existing list with one BHK changed, or the other BHK defaults are lost.
//
// No React Native / Expo import (the api import is types only), so it runs
// under jest's node environment.
import type { CreateQuotationInput, QuotationRequiredKey, QuotationSettings, QuotationSettingsPatch } from './api';

export type NumberParse = { ok: true; value: number | null } | { ok: false };

/** Blank → null. Strips `,`, spaces and `₹` so "₹1,00,000" parses. */
export function parseNumberInput(text: string | null | undefined): NumberParse {
  const t = String(text ?? '').replace(/[,\s₹]/g, '');
  if (!t) return { ok: true, value: null };
  // Number('') is 0 and Number('0x10') is 16; only plain decimals are numbers here.
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false };
  const n = Number(t);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

export interface NumberBound {
  min: number;
  max: number;
  /** carpetSqFt is "> 0", not ">= 0". */
  exclusiveMin?: boolean;
}

/** Same numbers as backend sanitizeSettings / the create handler's carpet check. */
export const SETTINGS_BOUNDS = {
  ratePerSqFt: { min: 1, max: 1000000 },
  plcPerSqFt: { min: 0, max: 100000 },
  parkingCharge: { min: 0, max: 100000000 },
  clubCharge: { min: 0, max: 100000000 },
  gstPercent: { min: 0, max: 28 },
  stampDutyPercent: { min: 0, max: 15 },
  registrationCharge: { min: 0, max: 10000000 },
  validityDays: { min: 1, max: 90 },
  floorRisePerSqFt: { min: 0, max: 100000 },
  floorRiseFromFloor: { min: 0, max: 200 },
  maintenancePerSqFt: { min: 0, max: 100000 },
  maintenanceMonths: { min: 0, max: 120 },
  carpetSqFt: { min: 0, max: 100000, exclusiveMin: true },
} satisfies Record<string, NumberBound>;

/** Text limits from sanitizeSettings and the create handler. */
export const TEXT_LIMITS = {
  defaultPaymentPlan: 2000,
  paymentPlan: 2000,
  termsText: 3000,
  bankDetails: 1000,
  buyerName: 120,
  remarks: 1000,
} as const;

export const DISCOUNT_ERROR = 'Discount 0 ya usse zyada hona chahiye';

export type DiscountParse = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Discount is optional (2=b). Blank or 0 → null, so the create body omits it
 * and the cost sheet gets no discount row at all (not a ₹0 row).
 */
export function discountFromInput(text: string | null | undefined): DiscountParse {
  const p = parseNumberInput(text);
  if (!p.ok) return { ok: false, error: DISCOUNT_ERROR };
  if (p.value === null || p.value === 0) return { ok: true, value: null };
  if (p.value < 0) return { ok: false, error: DISCOUNT_ERROR };
  return { ok: true, value: p.value };
}

/** Backend normBhk: "2 bhk" and "2BHK" are the same BHK. */
export const normBhk = (b: string | null | undefined) => String(b || '').toUpperCase().replace(/\s+/g, '');

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type EffectiveSettings = Partial<QuotationSettings> & { unitCarpetAreas?: { label: string; sqft: number }[] };

/**
 * Mirror of backend mergeSettings: lists replace, floorRise / maintenance
 * shallow-merge, null deletes. Used for the live preview and the "still
 * missing" check so the screen agrees with what the server will compute.
 */
export function effectiveSettings(
  stored: Partial<QuotationSettings> | null | undefined,
  patch: QuotationSettingsPatch | null | undefined,
): EffectiveSettings {
  const merged: Record<string, any> = { ...(stored || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null) delete merged[k];
    else if ((k === 'floorRise' || k === 'maintenance') && v && typeof v === 'object') merged[k] = { ...(merged[k] || {}), ...v };
    else merged[k] = v;
  }
  return merged as EffectiveSettings;
}

const REQUIRED_ORDER: QuotationRequiredKey[] = ['ratePerSqFt', 'carpetSqFt', 'gstPercent', 'stampDutyPercent', 'registrationCharge'];

/**
 * Which of `required` still has no value, with backend findMissing's checks
 * (a number, so 0% GST counts as filled). Wizard order.
 */
export function requiredStillMissing(
  required: readonly QuotationRequiredKey[],
  eff: EffectiveSettings,
  carpetSqFt: number | null | undefined,
): QuotationRequiredKey[] {
  const has: Record<QuotationRequiredKey, boolean> = {
    ratePerSqFt: isNum(eff.ratePerSqFt),
    carpetSqFt: isNum(carpetSqFt),
    gstPercent: isNum(eff.gstPercent),
    stampDutyPercent: isNum(eff.stampDutyPercent),
    registrationCharge: isNum(eff.registrationCharge),
  };
  return REQUIRED_ORDER.filter((k) => required.includes(k) && !has[k]);
}

/** Raw text as typed in the wizard's step 2 / 3. Missing or blank = not typed. */
export interface QuotationFormInput {
  ratePerSqFt?: string;
  carpetSqFt?: string;
  gstPercent?: string;
  stampDutyPercent?: string;
  registrationCharge?: string;
  floorRisePerSqFt?: string;
  floorRiseFromFloor?: string;
  plcPerSqFt?: string;
  parkingCharge?: string;
  clubCharge?: string;
  maintenancePerSqFt?: string;
  maintenanceMonths?: string;
  termsText?: string;
  bankDetails?: string;
  /** Step 3 text; sent as body.paymentPlan by the caller. */
  paymentPlan?: string;
}

export interface BuildOverridesContext {
  /** readiness.settings */
  settings: QuotationSettings;
  /** A flat is selected: carpet becomes that flat's override server-side. */
  unitId?: string | null;
  /** BHK picked when no flat is selected. */
  bhk?: string | null;
  /** The "Project mein save karo" switch (only when canEditSettings). */
  saveToProject: boolean;
}

export interface BuildOverridesResult {
  overrides: QuotationSettingsPatch;
  carpetSqFt?: number;
  /** Keyed by QuotationFormInput field name. Empty = valid. */
  errors: Record<string, string>;
}

const NUMBER_ERROR = 'Sahi number daalo';

function boundError(b: NumberBound): string {
  return b.exclusiveMin ? `0 se zyada aur ${b.max} tak hona chahiye` : `${b.min} se ${b.max} ke beech hona chahiye`;
}

/**
 * Build the POST /quotations `overrides` (+ top-level carpetSqFt) from what the
 * user typed. Rules (plan decisions 5 and 6):
 *  - blank fields are omitted, never null;
 *  - carpet is always top-level `carpetSqFt`, never an override key; only on
 *    the BHK path with saveToProject does it also go into carpetAreaByBhk,
 *    as the whole existing list with that BHK replaced;
 *  - with saveToProject on and no project default payment plan, a typed plan
 *    is also sent as overrides.defaultPaymentPlan.
 */
export function buildOverrides(form: QuotationFormInput, ctx: BuildOverridesContext): BuildOverridesResult {
  const overrides: QuotationSettingsPatch = {};
  const errors: Record<string, string> = {};
  const s = ctx.settings;

  const readNum = (field: keyof QuotationFormInput, bound: NumberBound): number | undefined => {
    const p = parseNumberInput(form[field]);
    if (!p.ok) {
      errors[field] = NUMBER_ERROR;
      return undefined;
    }
    if (p.value === null) return undefined;
    const tooLow = bound.exclusiveMin ? p.value <= bound.min : p.value < bound.min;
    if (tooLow || p.value > bound.max) {
      errors[field] = boundError(bound);
      return undefined;
    }
    return p.value;
  };
  const readText = (field: keyof QuotationFormInput, max: number): string | undefined => {
    const t = String(form[field] ?? '').trim();
    if (!t) return undefined;
    if (t.length > max) {
      errors[field] = `${max} characters tak hi likh sakte ho`;
      return undefined;
    }
    return t;
  };

  for (const key of ['ratePerSqFt', 'gstPercent', 'stampDutyPercent', 'registrationCharge', 'plcPerSqFt', 'parkingCharge', 'clubCharge'] as const) {
    const v = readNum(key, SETTINGS_BOUNDS[key]);
    if (v !== undefined) overrides[key] = v;
  }

  // Backend sanitizeSettings turns an absent sub-key into null and mergeSettings
  // then overwrites the stored one, so typing only "from floor" would wipe the
  // project's per-sq.ft rate. Fill the untyped half from the current settings.
  const frPer = readNum('floorRisePerSqFt', SETTINGS_BOUNDS.floorRisePerSqFt);
  const frFrom = readNum('floorRiseFromFloor', SETTINGS_BOUNDS.floorRiseFromFloor);
  if (frPer !== undefined || frFrom !== undefined) {
    overrides.floorRise = {
      perSqFt: frPer ?? s.floorRise?.perSqFt ?? null,
      fromFloor: frFrom ?? s.floorRise?.fromFloor ?? null,
    };
  }
  const mPer = readNum('maintenancePerSqFt', SETTINGS_BOUNDS.maintenancePerSqFt);
  const mMonths = readNum('maintenanceMonths', SETTINGS_BOUNDS.maintenanceMonths);
  if (mPer !== undefined || mMonths !== undefined) {
    overrides.maintenance = {
      perSqFt: mPer ?? s.maintenance?.perSqFt ?? null,
      months: mMonths ?? s.maintenance?.months ?? null,
    };
  }

  const terms = readText('termsText', TEXT_LIMITS.termsText);
  if (terms !== undefined) overrides.termsText = terms;
  const bank = readText('bankDetails', TEXT_LIMITS.bankDetails);
  if (bank !== undefined) overrides.bankDetails = bank;

  const plan = readText('paymentPlan', TEXT_LIMITS.paymentPlan);
  if (plan !== undefined && ctx.saveToProject && !String(s.defaultPaymentPlan ?? '').trim()) {
    overrides.defaultPaymentPlan = plan;
  }

  const result: BuildOverridesResult = { overrides, errors };
  const carpet = readNum('carpetSqFt', SETTINGS_BOUNDS.carpetSqFt);
  if (carpet !== undefined) {
    result.carpetSqFt = carpet;
    // With a flat selected the backend stores the typed carpet as that flat's
    // unitCarpetAreas override itself; a BHK default must not change then.
    if (!ctx.unitId && ctx.bhk && ctx.saveToProject) {
      const list = s.carpetAreaByBhk || [];
      const key = normBhk(ctx.bhk);
      const existing = list.find((c) => normBhk(c.bhk) === key);
      if (!existing || existing.sqft !== carpet) {
        overrides.carpetAreaByBhk = existing
          ? list.map((c) => (normBhk(c.bhk) === key ? { bhk: c.bhk, sqft: carpet } : c))
          : [...list, { bhk: ctx.bhk.trim(), sqft: carpet }];
      }
    }
  }
  return result;
}

export interface CreateBodyInput {
  projectId: string;
  /** readiness.unit: a flat is selected, so bhk / unitLabel / floor come from it server-side. */
  unit: { id: string } | null;
  /** BHK path only (no flat selected). */
  bhk: string;
  unitLabel: string;
  /** Parsed floor box; null when blank. BHK path only. */
  floor: number | null;
  /** buildOverrides() result. */
  built: Pick<BuildOverridesResult, 'overrides' | 'carpetSqFt'>;
  /** readiness.carpet.sqft: the carpet the project already resolves for this flat / BHK. */
  projectCarpetSqFt: number | null | undefined;
  /** The PLC switch, only meaningful when the project has a PLC rate. */
  applyPlc: boolean;
  discount: DiscountParse;
  paymentPlan: string | null | undefined;
  remarks: string;
  buyerName: string;
  buyerPhone: string;
  /** readiness.canEditSettings */
  canEditSettings: boolean;
  /** The "Project mein save karo" switch. */
  saveSwitch: boolean;
}

/**
 * The POST /quotations body (HIT_Backend controllers/quotationController.js
 * create()). Lifted unchanged out of the wizard's onCreate, where these rules
 * were inline and untested; the key order is kept so the JSON is identical.
 */
export function buildCreateBody(i: CreateBodyInput): CreateQuotationInput {
  const { built } = i;
  // The server 403s saveToProject from a non-editor, so the switch only counts for one.
  const saveToProject = i.canEditSettings && i.saveSwitch;
  const body: CreateQuotationInput = { projectId: i.projectId, buyer: { name: i.buyerName.trim() } };
  if (i.buyerPhone.trim()) body.buyer.phone = i.buyerPhone.trim();
  if (i.unit) {
    body.unitId = i.unit.id;
  } else {
    if (i.bhk.trim()) body.bhk = i.bhk.trim();
    if (i.unitLabel.trim()) body.unitLabel = i.unitLabel.trim();
    if (i.floor !== null) body.floor = i.floor;
  }
  // The prefilled default is not re-sent: the server resolves the same value,
  // and with saveToProject a re-sent flat carpet would become a per-flat override.
  if (built.carpetSqFt !== undefined && built.carpetSqFt !== i.projectCarpetSqFt) body.carpetSqFt = built.carpetSqFt;
  if (i.applyPlc) body.applyPlc = true;
  // 2=b: a blank or 0 discount box omits the key, so no discount line at all.
  if (i.discount.ok && i.discount.value !== null) body.discount = i.discount.value;
  const plan = (i.paymentPlan || '').trim();
  if (plan) body.paymentPlan = plan;
  if (i.remarks.trim()) body.remarks = i.remarks.trim();
  const hasOverrides = Object.keys(built.overrides).length > 0;
  if (hasOverrides) body.overrides = built.overrides;
  if (saveToProject && (hasOverrides || body.carpetSqFt !== undefined)) body.saveToProject = true;
  return body;
}

/** Backend create handler's buyer phone regex (after trim). Blank is allowed by the caller. */
export function isValidBuyerPhone(s: string | null | undefined): boolean {
  return /^[+\d][\d\s-]{6,19}$/.test(String(s ?? '').trim());
}
