// Parity guard: unitModeFor (mobile) vs PropertyTypeNormalizer.fromProject
// (server, the authority). unitModeFor is a hand-written mirror; until now
// nothing compared the two, so a keyword added on one side only would make the
// app open the flat form for a project the server treats as plot (or vice
// versa) and the save would 409. Runs only when HIT_Backend is checked out
// beside this repo, like the UnitInventoryService mirror in units.test.ts.
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { unitModeFor } from '../units';

const serverPath = resolve(__dirname, '../../../../HIT_Backend/services/PropertyTypeNormalizer.js');
const hasServer = existsSync(serverPath);

// Same bare-CommonJS loader as units.test.ts, for the same reason (jest would
// run the file through babel-preset-expo). PropertyTypeNormalizer has no
// top-level require, so the stub never fires.
const loadServerModule = (file: string) => {
  const mod: { exports: any } = { exports: {} };
  const requireStub = (id: string) => {
    throw new Error(`PropertyTypeNormalizer required "${id}" while loading; this parity test assumes no top-level requires`);
  };
  const wrapper = new Function('module', 'exports', 'require', '__filename', '__dirname', readFileSync(file, 'utf8'));
  wrapper(mod, mod.exports, requireStub, file, dirname(file));
  return mod.exports;
};

const LAND_FAMILIES = ['plot', 'farm_land', 'commercial_plot'];

// Every propertyType the add-project dropdown can produce
// (CATEGORY_PROPERTY_TYPES in app/(dashboard)/add-project.tsx).
const DROPDOWN_TYPES = [
  'Apartment / Flat', 'Villa', 'Independent House', 'Row House', 'Township', 'Residential Plot',
  'Farm House', 'Farm Land', 'Studio Apartment', 'Penthouse', 'Duplex', 'Serviced Apartment', 'Other',
  'Office Space', 'Retail', 'Showroom', 'Commercial Plot / Land', 'Industry', 'Co-working Space',
  'Warehouse / Storage', 'Hospitality',
  'Residential + Retail', 'Residential + Office', 'Residential + Commercial Complex', 'Mixed-Use Tower',
  'Mixed-Use Township', 'Residential + Hospitality', 'Residential + Commercial Plot', 'Integrated Development',
];

// Legacy / website projects that only carry projectType.
const PROJECT_TYPE_ONLY = ['plot', 'Plot', 'land', 'farm land', 'apartment', 'flat', 'villa', 'commercial plot'];

(hasServer ? describe : describe.skip)('unitModeFor matches the server normaliser', () => {
  const normalizer = hasServer ? loadServerModule(serverPath) : null;
  const serverMode = (p: { propertyType?: string; projectType?: string }) =>
    (LAND_FAMILIES.includes(normalizer.fromProject(p).family) ? 'plot' : 'flat');

  it.each(DROPDOWN_TYPES)('propertyType %p', (propertyType) => {
    expect(unitModeFor({ propertyType })).toBe(serverMode({ propertyType }));
  });

  it.each(PROJECT_TYPE_ONLY)('projectType-only %p', (projectType) => {
    expect(unitModeFor({ projectType })).toBe(serverMode({ projectType }));
  });

  it('propertyType wins over projectType on both sides', () => {
    const p = { propertyType: 'Apartment / Flat', projectType: 'plot' };
    expect(unitModeFor(p)).toBe(serverMode(p));
  });
});
