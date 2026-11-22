// Unit-inventory helpers shared by UnitGrid, UnitSetupForm, the detail sheet
// and the unit_update message bubble. Pure functions only — no network.
import { unitColors } from '../theme';
import type { ProjectUnit, UnitCounts, UnitSetup, UnitStatus } from './api';

export const UNIT_STATUSES: UnitStatus[] = ['available', 'booked', 'sold', 'on-hold'];

// Display labels match the server's STATUS_LABELS so the grid, the picker and
// the auto-message text all say the same word.
export const UNIT_STATUS: Record<UnitStatus, { label: string; color: string }> = {
  available: { label: 'Vacant', color: unitColors.available },
  booked: { label: 'Booked', color: unitColors.booked },
  sold: { label: 'Sold', color: unitColors.sold },
  'on-hold': { label: 'Hold', color: unitColors['on-hold'] },
};

// Literal mirrors of HIT_Backend/services/UnitInventoryService.js. They exist so
// the form can explain a problem before the request is sent; the server still
// validates independently. src/lib/__tests__/units.test.ts requires that file
// when it is present and fails if any of the three drift apart.
export const MAX_UNITS = 2000;
export const MAX_BLOCKS = 26;
export const MAX_PLOT_NUMBER = 9999;
// Block names share the tower rule (server MAX_TOWER_NAME) — one vocabulary for
// the two modes — so this stays the same literal 10 the flat branch below uses.
const MAX_BLOCK_NAME = 10;

/**
 * Facing values offered for a plot, copied verbatim from FACING_OPTIONS in
 * app/(dashboard)/add-project.tsx so the create form and the grid agree.
 *
 * `layoutEntities[].facing` (the web layout editor's plots) uses 4 LOWERCASE
 * values instead. The mismatch is accepted: the two inventories are separate
 * and are not read together, and normalising one of them would rewrite live
 * documents for a display-only field.
 */
export const PLOT_FACING_OPTIONS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];

export function statusMeta(status: string | undefined) {
  return UNIT_STATUS[(status as UnitStatus)] || UNIT_STATUS.available;
}

/**
 * Which inventory a unit belongs to — mirror of the server's unitKindOf.
 *
 * A MISSING `kind` means flat: every unit generated before the plot release was
 * written without the key and the schema default never reaches those documents
 * until they are re-saved. Named rather than inlined so the "missing means
 * flat" rule lives in exactly one place on the client too.
 */
export function unitKindOf(u: { kind?: string } | null | undefined): 'flat' | 'plot' {
  return u?.kind === 'plot' ? 'plot' : 'flat';
}

export function summarizeUnits(units: ProjectUnit[] | undefined): UnitCounts {
  const c: UnitCounts = { available: 0, booked: 0, sold: 0, onHold: 0, total: 0 };
  for (const u of units || []) {
    if (!u) continue;
    c.total += 1;
    if (u.status === 'booked') c.booked += 1;
    else if (u.status === 'sold') c.sold += 1;
    else if (u.status === 'on-hold') c.onHold += 1;
    else c.available += 1;
  }
  return c;
}

export interface TowerRows {
  tower: string;
  // Top floor first, like a building elevation, so the grid "reads" as the tower.
  floors: { floor: number; units: ProjectUnit[] }[];
}

/** tower (natural order) → floors (desc) → units (asc). */
export function groupUnits(units: ProjectUnit[] | undefined): TowerRows[] {
  const byTower = new Map<string, Map<number, ProjectUnit[]>>();
  for (const u of units || []) {
    if (!u) continue;
    let floors = byTower.get(u.tower);
    if (!floors) { floors = new Map(); byTower.set(u.tower, floors); }
    const row = floors.get(u.floor) || [];
    row.push(u);
    floors.set(u.floor, row);
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...byTower.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([tower, floors]) => ({
      tower,
      floors: [...floors.entries()]
        .sort(([a], [b]) => b - a)
        .map(([floor, list]) => ({ floor, units: list.sort((x, y) => x.unitNo - y.unitNo) })),
    }));
}

export interface PlotBlockRows {
  // '' for the unnamed block — the common "120 plots, no blocks" layout. The
  // caller omits the heading for it rather than printing "Block".
  block: string;
  units: ProjectUnit[];
}

/**
 * block (natural order, unnamed first) → plots (natural order by plotNumber).
 *
 * The plot equivalent of groupUnits, kept as a separate function instead of a
 * flag on that one: there is no floor axis here, so a plot block is a single
 * wrapping row and parameterising groupUnits would only make the flat path
 * (Skyline's 44 live units) harder to read and easier to break.
 *
 * Numeric collation is the same one groupUnits uses, so 12 < 12A < 100 rather
 * than the lexicographic 100 < 12 < 12A a plain sort would give.
 */
export function groupPlotUnits(units: ProjectUnit[] | undefined): PlotBlockRows[] {
  const byBlock = new Map<string, ProjectUnit[]>();
  for (const u of units || []) {
    // A $set past the array end pads `units` with nulls, same defence groupUnits
    // and the server's summarizeUnits carry.
    if (!u) continue;
    const key = u.block || '';
    const row = byBlock.get(key) || [];
    row.push(u);
    byBlock.set(key, row);
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...byBlock.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([block, list]) => ({
      block,
      units: list.sort((x, y) => collator.compare(String(x.plotNumber || x.label || ''), String(y.plotNumber || y.label || ''))),
    }));
}

/**
 * Who may change unit status — mirrors the server's authorizeProjectAccess
 * (admin, owner, co-captain, assigned agent).
 *
 * THIS IS NOT THE SECURITY BOUNDARY: the PATCH/PUT endpoints enforce the same
 * rule and answer 403 otherwise. It only exists so non-editors are not offered
 * a picker whose only outcome is an error toast.
 */
export function canEditUnits(
  user: { id?: string; _id?: string; role?: string } | null | undefined,
  project: { ownerId?: string; coCaptains?: string[]; assignedAgentId?: string } | null | undefined,
): boolean {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  const uid = String(user.id || user._id || '');
  if (!uid) return false;
  if (project.ownerId && project.ownerId === uid) return true;
  if (project.assignedAgentId && project.assignedAgentId === uid) return true;
  return (project.coCaptains || []).includes(uid);
}

/** Same label format as the server: {tower}-{floor}{unitNo padded to 2}. */
export function unitLabel(tower: string, floor: number, unitNo: number): string {
  return `${tower}-${floor}${String(unitNo).padStart(2, '0')}`;
}

/**
 * Same label format as the server's plotLabel: {block}-{plotNumber}, or the
 * bare number when the block is unnamed.
 *
 * UNPADDED on purpose, unlike unitLabel — the padding there only exists because
 * A-1101 is ambiguous (floor 1 unit 101 vs floor 11 unit 01), and a plain plot
 * range cannot collide. It must stay character-identical to the server's
 * version because mergeUnits matches on the exact label, so a format change
 * here would make every regenerate look like "all plots removed".
 */
export function plotLabel(block: string, plotNumber: string | number): string {
  return block ? `${block}-${plotNumber}` : String(plotNumber);
}

// Rule order copied from KEYWORD_RULES in HIT_Backend/services/PropertyTypeNormalizer.js.
// Mixed-use is tested first there, then farm house, then the land families.
const MIXED_USE_RE = /mixed[\s-]*use|integrated development|residential\s*\+|resi.*\+.*(retail|office|commercial|hospitality)/;
const FARM_HOUSE_RE = /farm\s*house|farmhouse/;
const LAND_RES = [
  /farm\s*land|agricultur|krishi|orchard|plantation/,
  /commercial\s*(plot|land)|industrial\s*(plot|land)/,
  /residential\s*plot|resi.*plot/,
  /\bplot\b|\bland\b|\bzameen\b|\bzamin\b|\bjameen\b/,
];

function modeFromTypeText(raw: string | undefined): 'flat' | 'plot' | null {
  const text = String(raw || '').toLowerCase().trim();
  if (!text) return null; // no signal in this field — fall through to the next one
  if (MIXED_USE_RE.test(text)) return 'flat';
  if (FARM_HOUSE_RE.test(text)) return 'flat';
  for (const re of LAND_RES) if (re.test(text)) return 'plot';
  return 'flat';
}

/**
 * Which setup form a project should be offered — a UI-convenience mirror of
 * PropertyTypeNormalizer.fromProject (precedence propertyType → projectType).
 *
 * THIS IS NOT THE AUTHORITY, in the same sense canEditUnits is not the security
 * boundary: the server decides the mode from `unitSetup.mode` and refuses a
 * mixed-kind save with a 409. This only picks which form to open, so a wrong
 * answer is a bad default, not a data problem.
 *
 * LAND FAMILIES ONLY in v1 (the normaliser's plot / farm_land / commercial_plot):
 * villa, row house, independent house and farm house stay flat, because a plot
 * grid cannot express a built unit.
 *
 * It deliberately disagrees with isPlotType in app/(dashboard)/add-project.tsx:
 * the normaliser tests mixed-use FIRST, so 'Residential + Commercial Plot' is
 * mixed_use → flat here while isPlotType calls it a plot. isPlotType keeps
 * driving the plot-size-range validation; the inventory must agree with the
 * server instead, and the group sheet and the create form must agree with each
 * other.
 *
 * Simplification worth knowing: the server falls through to projectType only
 * when propertyType normalises to nothing at all, which needs the full keyword
 * table. Here any non-empty propertyType that is not a land family answers
 * 'flat', so an unrecognised propertyType with projectType 'plot' resolves to
 * flat. propertyType comes from a fixed form dropdown, so that combination is
 * not reachable from the app.
 */
export function unitModeFor(
  p: { propertyType?: string; projectType?: string } | null | undefined,
): 'flat' | 'plot' {
  return modeFromTypeText(p?.propertyType) || modeFromTypeText(p?.projectType) || 'flat';
}

/**
 * Client-side preview/validation of a setup, using the server's limits so the
 * form can explain a problem before the request is sent. The server still
 * validates independently.
 */
export function previewUnitSetup(setup: UnitSetup): { total: number; first?: string; last?: string; error?: string } {
  // UnitSetup is a tagged union now; an absent mode is flat, exactly as on the
  // server, so only an explicit 'plot' takes the new branch and the flat path
  // below is byte-identical to what it was.
  if (setup.mode === 'plot') return previewPlotSetup(setup.blocks || []);
  const towers = setup.towers || [];
  if (!towers.length) return { total: 0, error: 'Add at least one tower' };
  if (towers.length > 26) return { total: 0, error: 'At most 26 towers' };
  const seen = new Set<string>();
  let total = 0;
  for (const t of towers) {
    const name = (t.name || '').trim();
    if (!name) return { total: 0, error: 'Every tower needs a name' };
    if (name.length > 10) return { total: 0, error: `Tower "${name}": name must be 10 characters or less` };
    const key = name.toLowerCase();
    if (seen.has(key)) return { total: 0, error: `Tower "${name}" is listed twice` };
    seen.add(key);
    if (!Number.isInteger(t.floors) || t.floors < 1 || t.floors > 200) return { total: 0, error: `Tower ${name}: floors must be 1 to 200` };
    if (!Number.isInteger(t.unitsPerFloor) || t.unitsPerFloor < 1 || t.unitsPerFloor > 99) return { total: 0, error: `Tower ${name}: units per floor must be 1 to 99` };
    total += t.floors * t.unitsPerFloor;
  }
  if (total > MAX_UNITS) return { total, error: `This setup has ${total} units; the limit is ${MAX_UNITS}` };
  const a = towers[0];
  const z = towers[towers.length - 1];
  return {
    total,
    first: unitLabel(a.name.trim(), 1, 1),
    last: unitLabel(z.name.trim(), z.floors, z.unitsPerFloor),
  };
}

/**
 * Plot half of previewUnitSetup. Messages read like the server's
 * generatePlotUnits so the user sees one vocabulary wherever the setup is
 * refused; the cap sentence is shared with the flat branch for the same reason.
 */
function previewPlotSetup(
  blocks: { name: string; from: number; to: number }[],
): { total: number; first?: string; last?: string; error?: string } {
  if (!blocks.length) return { total: 0, error: 'Add at least one block' };
  if (blocks.length > MAX_BLOCKS) return { total: 0, error: `A project can have at most ${MAX_BLOCKS} blocks` };
  const seen = new Set<string>();
  let unnamed = false;
  let total = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const name = (b?.name || '').trim();
    if (!name) {
      // '' is allowed once: two unnamed blocks produce the same bare numeric
      // labels, and the server's mergeUnits matches on label.
      if (unnamed) return { total: 0, error: 'Only one block can be left unnamed' };
      unnamed = true;
    } else {
      if (name.length > MAX_BLOCK_NAME) return { total: 0, error: `Block name "${name}" is longer than ${MAX_BLOCK_NAME} characters` };
      // Case-insensitive, same reason as towers: "A" and "a" read the same to a
      // buyer and would collide on the merge key.
      const key = name.toLowerCase();
      if (seen.has(key)) return { total: 0, error: `Block name "${name}" is used twice` };
      seen.add(key);
    }
    // The block's name, or its position when unnamed — error messages only.
    const label = name || `${i + 1}`;
    const from = Number(b?.from);
    const to = Number(b?.to);
    if (!Number.isInteger(from) || from < 1 || from > MAX_PLOT_NUMBER
      || !Number.isInteger(to) || to < 1 || to > MAX_PLOT_NUMBER) {
      return { total: 0, error: `Block ${label}: plot numbers must be whole numbers from 1 to ${MAX_PLOT_NUMBER}` };
    }
    if (to < from) return { total: 0, error: `Block ${label}: last plot number (${to}) is before the first (${from})` };
    total += to - from + 1;
  }
  if (total > MAX_UNITS) return { total, error: `This setup has ${total} units; the limit is ${MAX_UNITS}` };
  const a = blocks[0];
  const z = blocks[blocks.length - 1];
  return {
    total,
    first: plotLabel((a.name || '').trim(), a.from),
    last: plotLabel((z.name || '').trim(), z.to),
  };
}

/** Rebuild a UnitSetup from existing units, so "Edit Units" starts from what exists. */
export function setupFromUnits(units: ProjectUnit[] | undefined): UnitSetup | null {
  // Plot projects are reconstructed first: read as flats they would come back as
  // one nameless tower with every floor 0, and "Edit" would offer a form that
  // does not describe what is stored.
  const first = (units || []).find(u => u);
  if (first && unitKindOf(first) === 'plot') {
    const groups = groupPlotUnits(units);
    if (!groups.length) return null;
    return {
      mode: 'plot',
      blocks: groups.map(g => {
        // parseInt, so a stored '12A' contributes 12: non-numeric suffixes are
        // not generatable from this form (ranges emit String(n)), and ignoring
        // the suffix is better than refusing to open the form at all.
        const numbers = g.units
          .map(u => parseInt(String(u.plotNumber || ''), 10))
          .filter(n => Number.isFinite(n));
        return {
          name: g.block,
          // A block whose numbers are all unreadable falls back to 1..1 rather
          // than Infinity — the user then sees a draft they can correct.
          from: numbers.length ? Math.min(...numbers) : 1,
          to: numbers.length ? Math.max(...numbers) : 1,
        };
      }),
    };
  }
  const groups = groupUnits(units);
  if (!groups.length) return null;
  // No `mode` key on the flat side, deliberately — see the UnitSetup comment in
  // src/lib/api.ts: the server reads an absent mode as flat and the installed
  // APK never sends one.
  return {
    towers: groups.map(g => ({
      name: g.tower,
      floors: Math.max(...g.floors.map(f => f.floor)),
      unitsPerFloor: Math.max(...g.floors.map(f => Math.max(...f.units.map(u => u.unitNo)))),
    })),
    bhk: (units || []).find(u => u?.bhk)?.bhk || '',
  };
}
