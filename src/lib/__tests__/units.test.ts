// Tests for the plot half of the unit-inventory helpers.
//
// Three things are pinned here. (1) The limits and the label format are literal
// copies of HIT_Backend/services/UnitInventoryService.js — mergeUnits matches on
// the exact label, so a drift between the two would read as "every plot
// removed" on the next regenerate. (2) unitModeFor decides which setup form a
// project is offered and deliberately disagrees with isPlotType in
// add-project.tsx for mixed-use, which is the kind of rule that gets "fixed"
// back by accident. (3) The flat path carries Skyline's 44 live units, so the
// flat branch is asserted to be unchanged alongside the new plot branch.
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  MAX_UNITS,
  MAX_BLOCKS,
  MAX_PLOT_NUMBER,
  PLOT_FACING_OPTIONS,
  plotLabel,
  unitKindOf,
  groupPlotUnits,
  unitModeFor,
  previewUnitSetup,
  setupFromUnits,
  summarizeUnits,
} from '../units';
import type { ProjectUnit } from '../api';

// Shaped like transformUnit's output: a plot still carries tower '' / floor 0,
// which is exactly why the plot helpers must never read those fields.
const plot = (block: string, plotNumber: string, over: Partial<ProjectUnit> = {}): ProjectUnit => ({
  _id: `p-${block}-${plotNumber}`,
  tower: '',
  floor: 0,
  unitNo: 0,
  label: plotLabel(block, plotNumber),
  bhk: '',
  status: 'available',
  kind: 'plot',
  block,
  plotNumber,
  ...over,
});

const flat = (tower: string, floor: number, unitNo: number, over: Partial<ProjectUnit> = {}): ProjectUnit => ({
  _id: `f-${tower}-${floor}-${unitNo}`,
  tower,
  floor,
  unitNo,
  label: `${tower}-${floor}${String(unitNo).padStart(2, '0')}`,
  bhk: '2BHK',
  status: 'available',
  kind: 'flat',
  ...over,
});

describe('plotLabel', () => {
  it('joins a named block with the plot number', () => {
    expect(plotLabel('A', 7)).toBe('A-7');
    expect(plotLabel('A', '7')).toBe('A-7');
  });

  it('gives the bare number for an unnamed block', () => {
    expect(plotLabel('', 7)).toBe('7');
    expect(plotLabel('', '120')).toBe('120');
  });

  // Unpadded on purpose, unlike unitLabel: a plot range cannot collide, and
  // "Plot A-0007" is not how anyone refers to a plot.
  it('does not pad the number', () => {
    expect(plotLabel('A', 7)).not.toBe('A-07');
    expect(plotLabel('', 7)).not.toBe('07');
  });
});

describe('unitKindOf', () => {
  // The whole point of the helper: units generated before the plot release
  // carry no `kind` key, and all of those are flats.
  it('treats a missing kind as flat', () => {
    expect(unitKindOf({})).toBe('flat');
    expect(unitKindOf(undefined)).toBe('flat');
    expect(unitKindOf(null)).toBe('flat');
    expect(unitKindOf({ kind: 'flat' })).toBe('flat');
  });

  it('reads an explicit plot', () => {
    expect(unitKindOf({ kind: 'plot' })).toBe('plot');
  });
});

describe('groupPlotUnits', () => {
  it('groups by block and keeps the plots of each block together', () => {
    const groups = groupPlotUnits([plot('A', '1'), plot('B', '1'), plot('A', '2')]);
    expect(groups.map(g => g.block)).toEqual(['A', 'B']);
    expect(groups[0].units.map(u => u.plotNumber)).toEqual(['1', '2']);
  });

  it('orders blocks with the numeric-aware collator', () => {
    const groups = groupPlotUnits([plot('B10', '1'), plot('B2', '1'), plot('A', '1')]);
    expect(groups.map(g => g.block)).toEqual(['A', 'B2', 'B10']);
  });

  // A plain string sort would give 100 < 12 < 12A. Suffixed numbers are not
  // generatable yet, but a hand-edited document can carry one.
  it('orders plots 12 before 12A before 100', () => {
    const groups = groupPlotUnits([plot('A', '100'), plot('A', '12A'), plot('A', '12')]);
    expect(groups[0].units.map(u => u.plotNumber)).toEqual(['12', '12A', '100']);
  });

  it('puts the unnamed block first', () => {
    const groups = groupPlotUnits([plot('A', '1'), plot('', '1')]);
    expect(groups.map(g => g.block)).toEqual(['', 'A']);
  });

  it('survives holes and an empty input', () => {
    expect(groupPlotUnits([null as any, plot('A', '1')]).map(g => g.block)).toEqual(['A']);
    expect(groupPlotUnits(undefined)).toEqual([]);
    expect(groupPlotUnits([])).toEqual([]);
  });
});

describe('unitModeFor', () => {
  it('puts the land families in plot mode', () => {
    expect(unitModeFor({ propertyType: 'Residential Plot' })).toBe('plot');
    expect(unitModeFor({ propertyType: 'Commercial Plot / Land' })).toBe('plot');
    expect(unitModeFor({ propertyType: 'Farm Land' })).toBe('plot');
    expect(unitModeFor({ propertyType: 'Industrial Land' })).toBe('plot');
  });

  // v1 scope: only the normaliser's plot / farm_land / commercial_plot families.
  // A built unit cannot be expressed on a plot grid.
  it('keeps built types in flat mode, farm house included', () => {
    expect(unitModeFor({ propertyType: 'Apartment / Flat' })).toBe('flat');
    expect(unitModeFor({ propertyType: 'Villa' })).toBe('flat');
    expect(unitModeFor({ propertyType: 'Row House' })).toBe('flat');
    expect(unitModeFor({ propertyType: 'Farm House' })).toBe('flat');
  });

  // The normaliser tests mixed-use BEFORE the land rules, so this is mixed_use
  // and gets the flat form — even though isPlotType in add-project.tsx calls the
  // same string a plot. The divergence is deliberate; see unitModeFor's comment.
  it('resolves a mixed-use label to flat because mixed-use is tested first', () => {
    expect(unitModeFor({ propertyType: 'Residential + Commercial Plot' })).toBe('flat');
    expect(unitModeFor({ propertyType: 'Mixed-Use Tower' })).toBe('flat');
  });

  it('falls back to projectType when propertyType is empty', () => {
    expect(unitModeFor({ propertyType: '', projectType: 'plot' })).toBe('plot');
    expect(unitModeFor({ projectType: 'plot' })).toBe('plot');
    expect(unitModeFor({ projectType: 'flat' })).toBe('flat');
  });

  it('defaults to flat on no signal at all', () => {
    expect(unitModeFor({})).toBe('flat');
    expect(unitModeFor({ propertyType: '', projectType: '' })).toBe('flat');
    expect(unitModeFor(null)).toBe('flat');
    expect(unitModeFor(undefined)).toBe('flat');
  });
});

describe('previewUnitSetup — plot branch', () => {
  it('totals the ranges and labels the first and last plot', () => {
    const p = previewUnitSetup({ mode: 'plot', blocks: [{ name: 'A', from: 1, to: 40 }, { name: '', from: 1, to: 120 }] });
    expect(p.error).toBeUndefined();
    expect(p.total).toBe(160);
    expect(p.first).toBe('A-1');
    expect(p.last).toBe('120');
  });

  it('rejects an empty block list', () => {
    expect(previewUnitSetup({ mode: 'plot', blocks: [] }).error).toBe('Add at least one block');
  });

  it('rejects more blocks than the cap', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => ({ name: `B${i}`, from: 1, to: 2 }));
    expect(previewUnitSetup({ mode: 'plot', blocks }).error).toMatch(/at most 26 blocks/);
  });

  it('rejects a second unnamed block', () => {
    const blocks = [{ name: '', from: 1, to: 10 }, { name: '  ', from: 11, to: 20 }];
    expect(previewUnitSetup({ mode: 'plot', blocks }).error).toBe('Only one block can be left unnamed');
  });

  it('rejects two block names differing only in case', () => {
    const blocks = [{ name: 'A', from: 1, to: 10 }, { name: 'a', from: 11, to: 20 }];
    expect(previewUnitSetup({ mode: 'plot', blocks }).error).toBe('Block name "a" is used twice');
  });

  it('rejects a block name over 10 characters', () => {
    const blocks = [{ name: 'Phase-One-A', from: 1, to: 10 }];
    expect(previewUnitSetup({ mode: 'plot', blocks }).error).toMatch(/longer than 10 characters/);
  });

  it('rejects a last number before the first', () => {
    const blocks = [{ name: 'A', from: 40, to: 10 }];
    expect(previewUnitSetup({ mode: 'plot', blocks }).error).toBe('Block A: last plot number (10) is before the first (40)');
  });

  it('rejects zero, negative and fractional plot numbers', () => {
    for (const blocks of [
      [{ name: 'A', from: 0, to: 10 }],
      [{ name: 'A', from: -5, to: 10 }],
      [{ name: 'A', from: 1, to: 10.5 }],
      [{ name: 'A', from: NaN, to: 10 }],
    ]) {
      expect(previewUnitSetup({ mode: 'plot', blocks }).error).toMatch(/whole numbers from 1 to 9999/);
    }
  });

  it('accepts the MAX_PLOT_NUMBER boundary and rejects one past it', () => {
    const ok = previewUnitSetup({ mode: 'plot', blocks: [{ name: 'A', from: MAX_PLOT_NUMBER, to: MAX_PLOT_NUMBER }] });
    expect(ok.error).toBeUndefined();
    expect(ok.last).toBe('A-9999');
    const bad = previewUnitSetup({ mode: 'plot', blocks: [{ name: 'A', from: 1, to: MAX_PLOT_NUMBER + 1 }] });
    expect(bad.error).toMatch(/whole numbers from 1 to 9999/);
  });

  it('rejects a total over the project cap with the same sentence the flat branch uses', () => {
    const p = previewUnitSetup({ mode: 'plot', blocks: [{ name: 'A', from: 1, to: MAX_UNITS + 1 }] });
    expect(p.error).toBe(`This setup has ${MAX_UNITS + 1} units; the limit is ${MAX_UNITS}`);
  });

  // The unnamed block is the "120 plots, no blocks" layout, so it must preview
  // with bare numeric labels.
  it('labels an unnamed single block without a separator', () => {
    const p = previewUnitSetup({ mode: 'plot', blocks: [{ name: '', from: 1, to: 120 }] });
    expect(p.first).toBe('1');
    expect(p.last).toBe('120');
  });
});

// Regression: the flat branch is what Skyline's live grid goes through. An
// absent mode must keep taking it.
describe('previewUnitSetup — flat branch is unchanged', () => {
  it('still previews a tower setup with padded unit labels', () => {
    const p = previewUnitSetup({ towers: [{ name: 'A', floors: 11, unitsPerFloor: 4 }], bhk: '2BHK' });
    expect(p.error).toBeUndefined();
    expect(p.total).toBe(44);
    expect(p.first).toBe('A-101');
    expect(p.last).toBe('A-1104');
  });

  it('still rejects a missing tower name', () => {
    expect(previewUnitSetup({ towers: [{ name: '', floors: 2, unitsPerFloor: 2 }] }).error).toBe('Every tower needs a name');
  });
});

describe('setupFromUnits', () => {
  it('rebuilds a plot draft from stored plot units', () => {
    const setup = setupFromUnits([plot('A', '5'), plot('A', '40'), plot('', '1'), plot('', '120')]);
    expect(setup).toEqual({
      mode: 'plot',
      blocks: [{ name: '', from: 1, to: 120 }, { name: 'A', from: 5, to: 40 }],
    });
  });

  it('ignores a non-numeric suffix when deriving the range', () => {
    const setup = setupFromUnits([plot('A', '12'), plot('A', '12A'), plot('A', '30')]);
    expect(setup).toEqual({ mode: 'plot', blocks: [{ name: 'A', from: 12, to: 30 }] });
  });

  // No mode key on the flat side: the server reads an absent mode as flat and
  // the installed APK sends none, so adding one would break old-build parity.
  it('still returns the tower shape with no mode key for flats', () => {
    const setup = setupFromUnits([flat('A', 1, 1), flat('A', 11, 4)]);
    expect(setup).toEqual({ towers: [{ name: 'A', floors: 11, unitsPerFloor: 4 }], bhk: '2BHK' });
    expect(setup && 'mode' in setup).toBe(false);
  });

  it('returns null when there is nothing stored', () => {
    expect(setupFromUnits([])).toBeNull();
    expect(setupFromUnits(undefined)).toBeNull();
  });
});

describe('summarizeUnits over plots', () => {
  it('counts plot statuses the same way it counts flats', () => {
    const counts = summarizeUnits([
      plot('A', '1'),
      plot('A', '2', { status: 'booked' }),
      plot('A', '3', { status: 'sold' }),
      plot('', '1', { status: 'on-hold' }),
      null as any,
    ]);
    expect(counts).toEqual({ available: 1, booked: 1, sold: 1, onHold: 1, total: 4 });
  });
});

describe('PLOT_FACING_OPTIONS', () => {
  // Copied verbatim from FACING_OPTIONS in app/(dashboard)/add-project.tsx.
  // layoutEntities[].facing uses 4 lowercase values instead; that mismatch is
  // accepted because the two inventories are never read together.
  it('is the 8 Title-Case compass values the create form offers', () => {
    expect(PLOT_FACING_OPTIONS).toEqual(['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West']);
  });
});

// Drift guard. The mobile constants and plotLabel are hand copies of the
// server's; when the backend repo is checked out beside this one they are
// compared directly, and the pinned literals below are the fallback for a
// clone that only has HIT_Mobile. Source of truth either way:
// HIT_Backend/services/UnitInventoryService.js.
describe('server contract mirror', () => {
  const serverPath = resolve(__dirname, '../../../../HIT_Backend/services/UnitInventoryService.js');
  const hasServer = existsSync(serverPath);

  it('matches the pinned limits', () => {
    expect(MAX_UNITS).toBe(2000);
    expect(MAX_BLOCKS).toBe(26);
    expect(MAX_PLOT_NUMBER).toBe(9999);
  });

  /**
   * Evaluated in a bare CommonJS wrapper rather than required.
   *
   * `require(serverPath)` hands the file to jest, which runs it through
   * babel-preset-expo and rewrites it to need @babel/runtime helpers that do not
   * exist under HIT_Backend ("Cannot find module
   * '@babel/runtime/helpers/interopRequireDefault'"), and jest-runtime
   * intercepts module.createRequire too, so neither escape hatch works.
   *
   * Safe because UnitInventoryService has no top-level require at all — its two
   * impure functions pull in the Mongoose models lazily and are never called
   * here — so the stub below never fires and nothing touches a database.
   */
  const loadServerModule = (file: string) => {
    const mod: { exports: any } = { exports: {} };
    const requireStub = (id: string) => {
      throw new Error(`UnitInventoryService required "${id}" while loading; this mirror test assumes it has no top-level requires`);
    };
    const wrapper = new Function('module', 'exports', 'require', '__filename', '__dirname', readFileSync(file, 'utf8'));
    wrapper(mod, mod.exports, requireStub, file, dirname(file));
    return mod.exports;
  };

  (hasServer ? it : it.skip)('matches the server file when it is checked out beside this repo', () => {
    const server = loadServerModule(serverPath);
    expect(server.MAX_UNITS).toBe(MAX_UNITS);
    expect(server.MAX_BLOCKS).toBe(MAX_BLOCKS);
    expect(server.MAX_PLOT_NUMBER).toBe(MAX_PLOT_NUMBER);
    expect(server.plotLabel('A', 7)).toBe(plotLabel('A', 7));
    expect(server.plotLabel('', 7)).toBe(plotLabel('', 7));
    expect(server.unitKindOf({})).toBe(unitKindOf({}));
    expect(server.unitKindOf({ kind: 'plot' })).toBe(unitKindOf({ kind: 'plot' }));
  });
});
