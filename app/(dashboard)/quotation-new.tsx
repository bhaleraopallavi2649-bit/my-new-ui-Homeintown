// New quotation — a 4-step wizard: 1 Project (+ flat or BHK) · 2 Details ·
// 3 Buyer · 4 Bhejo.
//
// Step 2 is the "1=c" rule from the plan: the system first reads what the
// builder already filled in (GET quotation-readiness) and only asks for what is
// missing. A builder/captain can save the answers to the project; anyone else
// either asks the builder to fill them or fills them for this quotation only.
//
// The totals on screen are a preview (src/lib/quotationCalc.ts). The server
// computes and stores the real ones on create, and the PDF prints those.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Switch, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, ChevronDown, ChevronUp, Search, Building2, CheckCircle2, Send, Share2, FileText, Pencil,
} from '../../src/icons';
import {
  projectsApiExtended, quotationsApi, ApiError,
  Project, Quotation, QuotationReadiness, QuotationRequiredKey, QuotationFlat, QuotationSettings, CreateQuotationInput,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/authContext';
import { registerHardwareBack } from '../../src/lib/backGate';
import {
  buildCreateBody, buildOverrides, discountFromInput, effectiveSettings, isValidBuyerPhone, normBhk,
  parseNumberInput, requiredStillMissing, QuotationFormInput, TEXT_LIMITS,
} from '../../src/lib/quotationForm';
import { calculateQuotation, QuotationCalcSettings } from '../../src/lib/quotationCalc';
import { formatINR, formatIndianNumber, formatDateIN } from '../../src/lib/inr';
import { shareQuotationPdf } from '../../src/lib/quotationPdf';
import CostSheet from '../../src/components/quotation/CostSheet';
import EmptyState from '../../src/components/EmptyState';
import { useToast } from '../../src/components/Toast';
import { colors, radius, spacing, unitColors } from '../../src/theme';

// Green theme (matches Lead Match / My Group).
const QGREEN = '#1F4D3A';

// Same roles that see the Projects sidebar entry: they also get their own
// project list (drafts included) on top of the public one.
const OWN_LIST_ROLES = ['admin', 'builder', 'captain', 'agent'];
const STEPS = ['Project', 'Details', 'Buyer', 'Bhejo'];
const REQUIRED_KEYS: QuotationRequiredKey[] = ['ratePerSqFt', 'carpetSqFt', 'gstPercent', 'stampDutyPercent', 'registrationCharge'];

const NOT_LIVE = 'Quotation feature abhi server pe live nahi hai';
const REQUEST_429 = 'Request pehle hi bheji ja chuki hai. 1 ghante baad dobara bhej sakte ho.';
const SERVER_MISSING = 'Quotation banane ke liye ye bharna zaroori hai';
const PREVIEW_ERROR = 'Preview ke liye rate aur carpet area chahiye';

type FormKey = keyof QuotationFormInput;
type Step2Key = Exclude<FormKey, 'paymentPlan'>;

const REQUIRED_LABEL: Record<QuotationRequiredKey, string> = {
  ratePerSqFt: 'Rate (₹/sq.ft)',
  carpetSqFt: 'Carpet area (sq.ft)',
  gstPercent: 'GST (%)',
  stampDutyPercent: 'Stamp duty (%)',
  registrationCharge: 'Registration (₹)',
};

const OPTIONAL_FIELDS: { key: Step2Key; label: string; multiline?: boolean }[] = [
  { key: 'floorRisePerSqFt', label: 'Floor rise (₹/sq.ft per floor)' },
  { key: 'floorRiseFromFloor', label: 'Floor rise kis floor se' },
  { key: 'plcPerSqFt', label: 'PLC (₹/sq.ft)' },
  { key: 'parkingCharge', label: 'Parking (₹)' },
  { key: 'clubCharge', label: 'Club house (₹)' },
  { key: 'maintenancePerSqFt', label: 'Maintenance (₹/sq.ft per month)' },
  { key: 'maintenanceMonths', label: 'Maintenance (kitne months)' },
  { key: 'termsText', label: 'Terms', multiline: true },
  { key: 'bankDetails', label: 'Bank details', multiline: true },
];

/** The project's current value for a form field, shown as the placeholder. */
function currentOf(key: Step2Key, st: QuotationSettings): number | string | null {
  switch (key) {
    case 'ratePerSqFt': return st.ratePerSqFt;
    case 'gstPercent': return st.gstPercent;
    case 'stampDutyPercent': return st.stampDutyPercent;
    case 'registrationCharge': return st.registrationCharge;
    case 'floorRisePerSqFt': return st.floorRise?.perSqFt ?? null;
    case 'floorRiseFromFloor': return st.floorRise?.fromFloor ?? null;
    case 'plcPerSqFt': return st.plcPerSqFt ?? null;
    case 'parkingCharge': return st.parkingCharge ?? null;
    case 'clubCharge': return st.clubCharge ?? null;
    case 'maintenancePerSqFt': return st.maintenance?.perSqFt ?? null;
    case 'maintenanceMonths': return st.maintenance?.months ?? null;
    case 'termsText': return st.termsText ?? null;
    case 'bankDetails': return st.bankDetails ?? null;
    default: return null;
  }
}

function errMsg(e: any, fallback: string): string {
  // The backend with these routes is not deployed yet; prod's catch-all
  // answers { error: 'Route not found' }, which means nothing to the user.
  if (e instanceof ApiError && e.status === 404 && e.data?.error === 'Route not found') return NOT_LIVE;
  return e?.message || fallback;
}

const selKey = (unitId: string | null, bhk: string) => (unitId ? `u:${unitId}` : bhk.trim() ? `b:${normBhk(bhk)}` : '-');
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Top-level, not defined inside the screen: a component created per render
// would remount its TextInput and drop the keyboard on every keystroke.
function Field({ label, value, onChange, placeholder, error, hint, multiline, numeric, maxLength }: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string; error?: string;
  hint?: string; multiline?: boolean; numeric?: boolean; maxLength?: number;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        maxLength={maxLength}
        style={[s.input, multiline && s.inputMulti, !!error && s.inputError]}
      />
      {!!error && <Text style={s.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export default function QuotationNewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const role = user?.role ?? 'user';
  const params = useLocalSearchParams<{ projectId?: string; unitId?: string }>();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Step 1: project list ──
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Step 1: selection + readiness ──
  const [projectId, setProjectId] = useState<string | null>(params.projectId ? String(params.projectId) : null);
  // The caller (Projects ⋮ menu, property sheet) chose the project, so there is
  // no list to go back to: back on step 1 leaves the screen.
  const [lockedProject, setLockedProject] = useState(!!params.projectId);
  const [unitId, setUnitId] = useState<string | null>(params.unitId ? String(params.unitId) : null);
  const [bhk, setBhk] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [floorText, setFloorText] = useState('');
  const [r, setR] = useState<QuotationReadiness | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [rLoading, setRLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reqRef = useRef(0);
  const bhkTypingRef = useRef(false);
  // Set by the 422 path: the next readiness load must not overwrite a typed carpet.
  const keepTypedRef = useRef(false);

  // ── Step 2 ──
  const [form, setForm] = useState<QuotationFormInput>({});
  const [forced, setForced] = useState<QuotationRequiredKey[]>([]);
  const [saveSwitch, setSaveSwitch] = useState(true);
  const [choice, setChoice] = useState<null | 'self'>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  // ── Step 3 ──
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [applyPlc, setApplyPlc] = useState(false);
  const [remarks, setRemarks] = useState('');

  // ── Step 4 ──
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Quotation | null>(null);
  const [sharing, setSharing] = useState(false);

  const setField = (k: FormKey, t: string) => setForm(f => ({ ...f, [k]: t }));

  const loadProjects = useCallback(async () => {
    setPLoading(true);
    setPError(null);
    // getAllPublic reads the shared 60 s /public/projects cache; no new fetch
    // of that list is added here.
    const own = OWN_LIST_ROLES.includes(role) ? projectsApiExtended.getAll() : Promise.resolve([] as Project[]);
    const [o, p] = await Promise.allSettled([own, projectsApiExtended.getAllPublic()]);
    const seen = new Set<string>();
    const list: Project[] = [];
    for (const x of [...(o.status === 'fulfilled' ? o.value : []), ...(p.status === 'fulfilled' ? p.value : [])]) {
      if (!x?.id || seen.has(x.id)) continue;
      seen.add(x.id);
      list.push(x);
    }
    if (o.status === 'rejected' && p.status === 'rejected') setPError(errMsg(p.reason, 'Projects load nahi hue'));
    setProjects(list);
    setPLoading(false);
  }, [role]);

  useEffect(() => {
    if (!projectId && projects === null && !pLoading) loadProjects();
  }, [projectId, projects, pLoading, loadProjects]);

  const fetchReadiness = useCallback(async (pid: string, uid: string | null, b: string) => {
    const id = ++reqRef.current;
    setRLoading(true);
    try {
      const res = await quotationsApi.readiness(pid, { unitId: uid || undefined, bhk: uid ? undefined : b.trim() || undefined });
      if (id !== reqRef.current) return;
      setR(res);
      setReadyKey(selKey(uid, uid ? '' : b));
      // Carpet is per flat / BHK (2=c), so it is re-prefilled on every selection.
      // The 422 reload is the same selection, so a carpet the user typed stays.
      const keepTyped = keepTypedRef.current;
      keepTypedRef.current = false;
      setForm(f => ({
        ...f,
        carpetSqFt: keepTyped && f.carpetSqFt?.trim() ? f.carpetSqFt : res.carpet?.sqft != null ? String(res.carpet.sqft) : '',
        paymentPlan: f.paymentPlan?.trim() ? f.paymentPlan : (res.settings?.defaultPaymentPlan || ''),
      }));
    } catch (e: any) {
      if (id !== reqRef.current) return;
      toast.show(errMsg(e, 'Project load nahi hua'), 'error');
      // Project or flat not found (or the route not live): back to the list.
      if (e instanceof ApiError && e.status === 404) {
        setProjectId(null);
        setLockedProject(false);
        setUnitId(null);
        setR(null);
        setReadyKey(null);
      }
    } finally {
      if (id === reqRef.current) setRLoading(false);
    }
  }, [toast]);

  // One place that (re)loads readiness: project picked, flat or BHK changed,
  // or an explicit reload (409, "Nayi quotation"). Typing a free-text BHK is
  // debounced so each keystroke is not a request.
  const bhkKey = normBhk(bhk);
  useEffect(() => {
    if (!projectId) return;
    const delay = bhkTypingRef.current ? 500 : 0;
    bhkTypingRef.current = false;
    const t = setTimeout(() => { fetchReadiness(projectId, unitId, bhk); }, delay);
    return () => clearTimeout(t);
    // `bhk` is read through bhkKey on purpose: case/space edits are the same BHK.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, unitId, bhkKey, reloadTick, fetchReadiness]);

  const resetQuotationInputs = () => {
    setForm({});
    setForced([]);
    setSaveSwitch(true);
    setChoice(null);
    setRequestSent(false);
    setOptionalOpen(false);
    setBuyerName('');
    setBuyerPhone('');
    setDiscountText('');
    setApplyPlc(false);
    setRemarks('');
    setCreated(null);
  };

  const selectProject = (p: Project) => {
    reqRef.current++;
    resetQuotationInputs();
    setR(null);
    setReadyKey(null);
    setUnitId(null);
    setBhk('');
    setUnitLabel('');
    setFloorText('');
    setProjectId(p.id);
  };

  const clearProject = () => {
    reqRef.current++;
    setRLoading(false);
    setProjectId(null);
    setR(null);
    setReadyKey(null);
    setUnitId(null);
    setBhk('');
  };

  // ── Derived ──
  const flatsMode = !!r && r.flats.length > 0;
  const canEdit = !!r?.canEditSettings;
  const saveToProject = canEdit && saveSwitch;
  const floorParse = parseNumberInput(floorText);
  const floorNum = floorParse.ok && floorParse.value !== null ? floorParse.value : null;
  const floorError = !floorParse.ok || (floorNum !== null && (!Number.isInteger(floorNum) || floorNum < 0 || floorNum > 200))
    ? 'Floor 0 se 200 ke beech hona chahiye' : undefined;

  const built = useMemo(() => (r ? buildOverrides(form, {
    settings: r.settings,
    unitId: r.unit?.id ?? null,
    bhk: flatsMode ? null : bhk.trim() || null,
    saveToProject,
  }) : null), [r, form, flatsMode, bhk, saveToProject]);

  const eff = useMemo(() => (r && built ? effectiveSettings(r.settings, built.overrides) : null), [r, built]);
  // A cleared carpet box is omitted from the body, so the server falls back to
  // the flat / BHK default; the preview and the missing check do the same.
  const effCarpet = built?.carpetSqFt ?? r?.carpet?.sqft ?? null;

  const required = useMemo(() => {
    const set = new Set<QuotationRequiredKey>([...(r?.missing.required || []), ...forced]);
    return REQUIRED_KEYS.filter(k => set.has(k));
  }, [r, forced]);
  const stillMissing = r && eff ? requiredStillMissing(required, eff, effCarpet) : REQUIRED_KEYS;
  const step2Errors = Object.keys(built?.errors || {}).filter(k => k !== 'paymentPlan');
  // A non-editor with something missing must pick "fill it myself": sending
  // the builder a request never creates a quotation by itself.
  const formVisible = canEdit || required.length === 0 || choice === 'self';

  const discount = discountFromInput(discountText);
  const plcShown = isNum(eff?.plcPerSqFt);
  const phoneError = buyerPhone.trim() && !isValidBuyerPhone(buyerPhone) ? 'Sahi phone number daalo' : undefined;
  const floorForCalc = r?.unit ? r.unit.floor : floorNum;

  const preview = useMemo(() => {
    if (!eff) return null;
    try {
      return calculateQuotation({
        carpetSqFt: effCarpet,
        ratePerSqFt: eff.ratePerSqFt,
        floor: floorForCalc,
        applyPlc: plcShown && applyPlc,
        discount: discount.ok ? discount.value : null,
        settings: eff as QuotationCalcSettings,
      });
    } catch {
      return null;
    }
  }, [eff, effCarpet, floorForCalc, plcShown, applyPlc, discount.ok, discount.ok ? discount.value : null]);

  const currentKey = selKey(unitId, unitId ? '' : bhk);
  const step1Ready = !!r && !rLoading && readyKey === currentKey
    && (flatsMode ? !!r.unit && r.unit.id === unitId : !!bhk.trim()) && !floorError;
  const step2Ready = !!r && formVisible && stillMissing.length === 0 && step2Errors.length === 0 && !rLoading;
  const step3Ready = !!buyerName.trim() && !phoneError && discount.ok && !built?.errors.paymentPlan;

  const unitText = (() => {
    if (!r) return '';
    if (r.unit) return [r.unit.tower, r.unit.label, r.unit.bhk].filter(Boolean).join(' · ');
    return [bhk.trim(), unitLabel.trim() && `Flat ${unitLabel.trim()}`, floorNum !== null && `Floor ${floorNum}`].filter(Boolean).join(' · ');
  })();

  // ── Back ──
  const goBack = () => {
    if (creating) return;
    if (created) { router.back(); return; }
    if (step > 1) { setStep((step - 1) as 1 | 2 | 3); return; }
    if (projectId && !lockedProject) { clearProject(); return; }
    router.back();
  };
  const backRef = useRef(goBack);
  backRef.current = goBack;
  useFocusEffect(useCallback(() => registerHardwareBack(BackHandler, true, backRef), []));

  // ── Actions ──
  const onRequestBuilder = async () => {
    if (!projectId || requestBusy) return;
    setRequestBusy(true);
    try {
      await quotationsApi.requestSettings(projectId, required);
      setRequestSent(true);
      toast.show('Request bhej di ✓', 'success');
    } catch (e: any) {
      // Business rule (one request per hour), not the rate limiter, so the
      // generic "Too many requests" copy from handleResponse is replaced.
      toast.show(e instanceof ApiError && e.status === 429 ? REQUEST_429 : errMsg(e, 'Request nahi gayi'), 'error');
    } finally {
      setRequestBusy(false);
    }
  };

  const onCreate = async () => {
    if (!r || !built || !projectId || creating) return;
    // The body rules live in buildCreateBody (unit-tested); they were inline here.
    const body: CreateQuotationInput = buildCreateBody({
      projectId,
      unit: r.unit,
      bhk,
      unitLabel,
      floor: floorNum,
      built,
      projectCarpetSqFt: r.carpet?.sqft,
      applyPlc: plcShown && applyPlc,
      discount,
      paymentPlan: form.paymentPlan,
      remarks,
      buyerName,
      buyerPhone,
      canEditSettings: canEdit,
      saveSwitch,
    });

    setCreating(true);
    try {
      const q = await quotationsApi.create(body);
      setCreated(q);
      toast.show(`Quotation ${q.number} ban gayi ✓`, 'success');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 422) {
        const miss: QuotationRequiredKey[] = Array.isArray(e.data?.missing)
          ? e.data.missing.filter((k: any) => REQUIRED_KEYS.includes(k)) : [];
        // Before, this only set `forced` and went to step 2 on the old
        // readiness. A 422 here means the project changed after readiness
        // loaded (e.g. the builder cleared a value), so the stale settings
        // still "had" the key, stillMissing stayed empty, Next stayed enabled
        // and the same body got the same 422 again. Reload readiness so the
        // preview and the missing check use what the server sees, keep what
        // the user typed, open the form, and mark the keys until filled.
        setForced(miss);
        setChoice('self');
        keepTypedRef.current = true;
        setReloadTick(t => t + 1);
        setStep(2);
        toast.show('Kuch zaroori details baaki hain', 'error');
      } else if (e instanceof ApiError && e.status === 409) {
        // The flat was booked/sold meanwhile: refresh the flat statuses.
        toast.show(e.message, 'error');
        setUnitId(null);
        setReloadTick(t => t + 1);
        setStep(1);
      } else if (e instanceof ApiError && e.status === 403) {
        toast.show(e.message, 'error');
        setSaveSwitch(false);
      } else {
        toast.show(errMsg(e, 'Quotation nahi bani'), 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const onSharePdf = async () => {
    if (!created || sharing) return;
    setSharing(true);
    try { await shareQuotationPdf(created); } catch (e: any) { toast.show(e?.message || 'PDF share nahi hua', 'error'); } finally { setSharing(false); }
  };

  const onNewQuotation = () => {
    resetQuotationInputs();
    setUnitId(null);
    setBhk('');
    setUnitLabel('');
    setFloorText('');
    setStep(1);
    // Same project, fresh flat statuses (the one just quoted may have changed).
    setReloadTick(t => t + 1);
  };

  // ── Render helpers ──
  const renderProjectList = () => {
    if (pLoading || projects === null) return <View style={s.center}><ActivityIndicator color={QGREEN} /></View>;
    if (pError) {
      return (
        <EmptyState icon={<Building2 size={28} color={QGREEN} />} title={pError} actionLabel="Retry" onAction={loadProjects} />
      );
    }
    const q = search.trim().toLowerCase();
    const list = q
      ? projects.filter(p => [p.name, p.city, p.location].some(v => String(v || '').toLowerCase().includes(q)))
      : projects;
    return (
      <>
        <View style={s.searchBox}>
          <Search size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search project"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
          />
        </View>
        {list.length === 0 ? (
          <EmptyState icon={<Building2 size={28} color={QGREEN} />} title="Koi project nahi mila" />
        ) : list.map(p => (
          <Pressable key={p.id} style={s.projectRow} onPress={() => selectProject(p)} accessibilityRole="button">
            <Building2 size={18} color={QGREEN} />
            <View style={{ flex: 1 }}>
              <Text style={s.projectName} numberOfLines={1}>{p.name}</Text>
              {!!(p.location || p.city) && (
                <Text style={s.muted} numberOfLines={1}>{[p.location, p.city].filter(Boolean).join(', ')}</Text>
              )}
            </View>
            {!p.isPublished && <Text style={s.draftPill}>Draft</Text>}
          </Pressable>
        ))}
      </>
    );
  };

  const renderUnitPicker = () => {
    if (!r) return <View style={s.center}><ActivityIndicator color={QGREEN} /></View>;
    const towers = new Map<string, QuotationFlat[]>();
    for (const f of r.flats) {
      const k = f.tower || '';
      towers.set(k, [...(towers.get(k) || []), f]);
    }
    return (
      <>
        <View style={s.box}>
          <Text style={s.projectName}>{r.project.projectName}</Text>
          {!!(r.project.location || r.project.city) && (
            <Text style={s.muted}>{[r.project.location, r.project.city].filter(Boolean).join(', ')}</Text>
          )}
          {!lockedProject && (
            <Pressable onPress={clearProject} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>Project badlo</Text>
            </Pressable>
          )}
        </View>

        {flatsMode ? (
          <View style={s.box}>
            <View style={s.rowBetween}>
              <Text style={s.sectionLabel}>Flat chuno</Text>
              {rLoading && <ActivityIndicator size="small" color={QGREEN} />}
            </View>
            {[...towers.entries()].map(([tower, flats]) => (
              <View key={tower || '-'} style={{ gap: spacing.sm }}>
                <Text style={s.towerLabel}>{tower || 'Flats'}</Text>
                <View style={s.chips}>
                  {flats.map(f => {
                    // Booked / sold flats cannot be quoted (the server answers 409).
                    const blocked = f.status === 'booked' || f.status === 'sold';
                    const selected = unitId === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        disabled={blocked}
                        onPress={() => setUnitId(f.id)}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: blocked, selected }}
                        style={[s.flatChip, { borderColor: unitColors[f.status] ?? colors.line }, selected && s.chipSelected, blocked && s.dim]}
                      >
                        <View style={[s.dot, { backgroundColor: unitColors[f.status] ?? colors.muted }]} />
                        <Text style={[s.chipText, selected && s.chipTextSelected]}>
                          {f.label}{f.bhk ? ` · ${f.bhk}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.box}>
            <View style={s.rowBetween}>
              <Text style={s.sectionLabel}>BHK chuno</Text>
              {rLoading && <ActivityIndicator size="small" color={QGREEN} />}
            </View>
            {r.project.bhkOptions.length > 0 ? (
              <View style={s.chips}>
                {r.project.bhkOptions.map(b => {
                  const selected = normBhk(b) === bhkKey;
                  return (
                    <Pressable
                      key={b}
                      onPress={() => setBhk(b)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[s.chip, selected && s.chipSelected]}
                    >
                      <Text style={[s.chipText, selected && s.chipTextSelected]}>{b}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Field
                label="BHK"
                value={bhk}
                onChange={t => { bhkTypingRef.current = true; setBhk(t); }}
                placeholder="e.g. 2 BHK"
              />
            )}
            <Field label="Flat no. (optional)" value={unitLabel} onChange={setUnitLabel} placeholder="e.g. A-502" />
            <Field label="Floor (optional)" value={floorText} onChange={setFloorText} placeholder="e.g. 5" numeric error={floorError} />
          </View>
        )}
      </>
    );
  };

  // A key the server's 422 named is shown in red until the user fills it;
  // stillMissing drops it as soon as the typed (or reloaded) value counts.
  const serverMissingError = (k: QuotationRequiredKey) =>
    forced.includes(k) && stillMissing.includes(k) ? SERVER_MISSING : undefined;

  const renderForm = () => {
    if (!r) return null;
    const missingFields = required.filter(k => k !== 'carpetSqFt');
    const carpetHint = r.carpet?.source === 'bhk' ? 'BHK default' : r.carpet?.source === 'unit' ? 'Is flat ka' : undefined;
    return (
      <View style={s.box}>
        <Field
          label={`${REQUIRED_LABEL.carpetSqFt}${required.includes('carpetSqFt') ? ' *' : ''}`}
          value={form.carpetSqFt ?? ''}
          onChange={t => setField('carpetSqFt', t)}
          placeholder={required.includes('carpetSqFt') ? 'Zaroori' : r.carpet?.sqft != null ? `Abhi: ${formatIndianNumber(r.carpet.sqft)}` : undefined}
          numeric
          error={built?.errors.carpetSqFt ?? serverMissingError('carpetSqFt')}
          hint={carpetHint}
        />
        {missingFields.map(k => (
          <Field
            key={k}
            label={`${REQUIRED_LABEL[k]} *`}
            value={form[k] ?? ''}
            onChange={t => setField(k, t)}
            placeholder="Zaroori"
            numeric
            error={built?.errors[k] ?? serverMissingError(k)}
          />
        ))}

        <Pressable style={s.rowBetween} onPress={() => setOptionalOpen(o => !o)} accessibilityRole="button">
          <Text style={s.sectionLabel}>Aur details (optional)</Text>
          {optionalOpen ? <ChevronUp size={16} color={colors.muted2} /> : <ChevronDown size={16} color={colors.muted2} />}
        </Pressable>
        {optionalOpen && (
          <>
            <Text style={s.hint}>Khali chhodo to project ki value hi lagegi.</Text>
            {OPTIONAL_FIELDS.map(f => {
              const cur = currentOf(f.key, r.settings);
              const placeholder = isNum(cur) ? `Abhi: ${formatIndianNumber(cur)}` : cur ? 'Abhi project ka text lagega' : 'Optional';
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  value={form[f.key] ?? ''}
                  onChange={t => setField(f.key, t)}
                  placeholder={placeholder}
                  numeric={!f.multiline}
                  multiline={f.multiline}
                  maxLength={f.key === 'termsText' ? TEXT_LIMITS.termsText : f.key === 'bankDetails' ? TEXT_LIMITS.bankDetails : undefined}
                  error={built?.errors[f.key]}
                />
              );
            })}
          </>
        )}

        {canEdit && (
          <View style={s.switchRow}>
            <Text style={[s.fieldLabel, { flex: 1 }]}>Project mein save karo (sab quotations ke liye)</Text>
            <Switch
              value={saveSwitch}
              onValueChange={setSaveSwitch}
              trackColor={{ false: colors.line, true: QGREEN }}
              thumbColor={colors.white}
            />
          </View>
        )}
      </View>
    );
  };

  const renderStep2 = () => {
    if (!r) return null;
    const missingText = required.map(k => REQUIRED_LABEL[k]).join(', ');
    return (
      <>
        {required.length === 0 ? (
          <View style={[s.box, s.okBox]}>
            <CheckCircle2 size={18} color={colors.greenText} />
            <Text style={s.okText}>Saari zaroori details mil gayi ✓</Text>
          </View>
        ) : (
          <View style={[s.box, s.warnBox]}>
            <Text style={s.warnText}>Builder ne ye details abhi nahi bhari: {missingText}</Text>
          </View>
        )}

        {!formVisible ? (
          <>
            <View style={s.box}>
              <Text style={s.choiceTitle}>Builder ko request bhejo</Text>
              {requestSent ? (
                <>
                  <Text style={s.muted}>Request bhej di ✓ — builder details bharega to notification aayega</Text>
                  <Pressable style={s.outlineBtn} onPress={() => setChoice('self')} accessibilityRole="button">
                    <Pencil size={15} color={QGREEN} />
                    <Text style={s.outlineText}>Tab tak khud bharo</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={s.muted}>Builder ko notification jayega ki ye details bhar de.</Text>
                  <Pressable style={[s.outlineBtn, requestBusy && s.dim]} onPress={onRequestBuilder} disabled={requestBusy} accessibilityRole="button">
                    {requestBusy ? <ActivityIndicator size="small" color={QGREEN} /> : <Send size={15} color={QGREEN} />}
                    <Text style={s.outlineText}>Request bhejo</Text>
                  </Pressable>
                </>
              )}
            </View>
            <Pressable style={s.box} onPress={() => setChoice('self')} accessibilityRole="button">
              <Text style={s.choiceTitle}>Sirf is quotation ke liye bharo</Text>
              <Text style={s.muted}>Aap khud bharo; project ki details nahi badlengi.</Text>
            </Pressable>
          </>
        ) : (
          <>
            {!canEdit && choice === 'self' && required.length > 0 && (
              <Pressable onPress={() => setChoice(null)} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>Builder ko request bhejni hai?</Text>
              </Pressable>
            )}
            {renderForm()}
          </>
        )}
      </>
    );
  };

  const renderStep3 = () => (
    <>
      <View style={s.box}>
        <Field label="Buyer ka naam *" value={buyerName} onChange={setBuyerName} placeholder="Naam" maxLength={TEXT_LIMITS.buyerName} />
        <Field label="Buyer ka phone (optional)" value={buyerPhone} onChange={setBuyerPhone} placeholder="+91…" error={phoneError} />
        <Field
          label="Discount (₹)"
          value={discountText}
          onChange={setDiscountText}
          placeholder="Discount (optional) — khali chhodo agar nahi hai"
          numeric
          error={discount.ok ? undefined : discount.error}
        />
        {plcShown && (
          <View style={s.switchRow}>
            <Text style={[s.fieldLabel, { flex: 1 }]}>PLC lagao (₹{formatIndianNumber(eff!.plcPerSqFt as number)}/sq.ft)</Text>
            <Switch
              value={applyPlc}
              onValueChange={setApplyPlc}
              trackColor={{ false: colors.line, true: QGREEN }}
              thumbColor={colors.white}
            />
          </View>
        )}
        <Field
          label="Payment plan"
          value={form.paymentPlan ?? ''}
          onChange={t => setField('paymentPlan', t)}
          placeholder="e.g. 10% booking, 40% on slab…"
          multiline
          maxLength={TEXT_LIMITS.paymentPlan}
          error={built?.errors.paymentPlan}
        />
        <Field label="Remarks (optional)" value={remarks} onChange={setRemarks} multiline maxLength={TEXT_LIMITS.remarks} />
      </View>

      <View style={s.box}>
        <Text style={s.sectionLabel}>Preview</Text>
        {preview ? <CostSheet lines={preview.lines} taxes={preview.taxes} totals={preview.totals} /> : <Text style={s.muted}>{PREVIEW_ERROR}</Text>}
        <Text style={s.hint}>Final amount server se banega</Text>
      </View>
    </>
  );

  const renderStep4 = () => {
    if (created) {
      const u = created.unit;
      const flat = [u.tower, u.label, u.bhk, u.floor != null ? `Floor ${u.floor}` : null].filter(Boolean).join(' · ');
      return (
        <View style={s.box}>
          <View style={s.rowBetween}>
            <Text style={s.projectName}>{created.number}</Text>
            <CheckCircle2 size={20} color={colors.green} />
          </View>
          <Text style={s.summaryLine}>{created.projectSnapshot?.projectName || r?.project.projectName}</Text>
          {!!flat && <Text style={s.muted}>{flat}</Text>}
          {!!created.buyer?.name && <Text style={s.muted}>Buyer: {created.buyer.name}{created.buyer.phone ? ` · ${created.buyer.phone}` : ''}</Text>}
          <Text style={s.grand}>{formatINR(created.totals.grandTotal)}</Text>
          <Text style={s.muted}>Valid till {formatDateIN(created.validUntil)}</Text>

          <Pressable style={[s.primaryBtn, sharing && s.dim]} onPress={onSharePdf} disabled={sharing} accessibilityRole="button">
            {sharing ? <ActivityIndicator size="small" color={colors.white} /> : <Share2 size={15} color={colors.white} />}
            <Text style={s.primaryText}>WhatsApp pe PDF bhejo</Text>
          </Pressable>
          <Pressable style={s.outlineBtn} onPress={() => router.replace('/(dashboard)/quotations' as any)} accessibilityRole="button">
            <FileText size={15} color={QGREEN} />
            <Text style={s.outlineText}>Meri Quotations</Text>
          </Pressable>
          <Pressable style={s.outlineBtn} onPress={onNewQuotation} accessibilityRole="button">
            <Text style={s.outlineText}>Nayi quotation</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={s.box}>
        <Text style={s.projectName}>{r?.project.projectName}</Text>
        {!!unitText && <Text style={s.muted}>{unitText}</Text>}
        <Text style={s.muted}>Buyer: {buyerName.trim()}{buyerPhone.trim() ? ` · ${buyerPhone.trim()}` : ''}</Text>
        {preview ? <Text style={s.grand}>{formatINR(preview.totals.grandTotal)}</Text> : <Text style={s.muted}>{PREVIEW_ERROR}</Text>}
        <Text style={s.hint}>Final amount server se banega</Text>
        <Pressable style={[s.primaryBtn, creating && s.dim]} onPress={onCreate} disabled={creating} accessibilityRole="button">
          {creating ? <ActivityIndicator size="small" color={colors.white} /> : <FileText size={15} color={colors.white} />}
          <Text style={s.primaryText}>Quotation banao</Text>
        </Pressable>
      </View>
    );
  };

  const nextEnabled = step === 1 ? step1Ready : step === 2 ? step2Ready : step === 3 ? step3Ready : false;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>New Quotation</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {step === 1 && (projectId ? renderUnitPicker() : renderProjectList())}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>
      {step < 4 && (step > 1 || !!projectId) && (
        <View style={[s.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Pressable
            style={[s.primaryBtn, !nextEnabled && s.dim]}
            onPress={() => nextEnabled && setStep((step + 1) as 2 | 3 | 4)}
            disabled={!nextEnabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !nextEnabled }}
          >
            <Text style={s.primaryText}>Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF8EE' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontSize: 21, fontWeight: '800', color: QGREEN },
  steps: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  stepText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  stepActive: { color: QGREEN, fontWeight: '800' },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  center: { paddingVertical: 60, alignItems: 'center' },

  box: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  okBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.greenBg, borderColor: colors.greenBorder },
  okText: { fontSize: 13, fontWeight: '700', color: colors.greenText },
  warnBox: { backgroundColor: colors.amberBg, borderColor: colors.amberBorder },
  warnText: { fontSize: 12, fontWeight: '600', color: colors.amberText },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: QGREEN, textTransform: 'uppercase', letterSpacing: 0.8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontSize: 12, color: colors.muted2 },
  hint: { fontSize: 11, color: colors.muted },
  link: { fontSize: 12, fontWeight: '700', color: QGREEN },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.ink },
  // No box around each project: plain row with a hairline divider.
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: 'transparent', paddingVertical: spacing.md, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(31,77,58,0.12)' },
  projectName: { fontSize: 15, fontWeight: '800', color: QGREEN },
  draftPill: { fontSize: 10, fontWeight: '700', color: colors.slateText, backgroundColor: colors.slateBg, borderWidth: 1, borderColor: colors.slateBorder, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  towerLabel: { fontSize: 12, fontWeight: '700', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  flatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, backgroundColor: colors.white },
  chipSelected: { backgroundColor: QGREEN, borderColor: QGREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.white },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dim: { opacity: 0.4 },

  fieldWrap: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: QGREEN },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: colors.ink, backgroundColor: colors.cream },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.red },
  errorText: { fontSize: 11, color: colors.redText },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  choiceTitle: { fontSize: 14, fontWeight: '800', color: QGREEN },
  summaryLine: { fontSize: 13, fontWeight: '700', color: colors.ink },
  grand: { fontSize: 20, fontWeight: '800', color: QGREEN },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: QGREEN, paddingVertical: 14, borderRadius: radius.md },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: QGREEN, backgroundColor: colors.white },
  outlineText: { fontSize: 12, fontWeight: '700', color: QGREEN },
});
