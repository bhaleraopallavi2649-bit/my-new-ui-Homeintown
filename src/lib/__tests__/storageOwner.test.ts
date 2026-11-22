// P6-03: per-user AI Assist keys are kept for the same user and dropped on an
// account switch. storageOwner.ensure must never throw.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

// Small Map-backed AsyncStorage with injectable failures. (Spying on the
// package's jest mock recursed, because its methods are already jest.fn.)
const mockStore = new Map<string, string>();
const mockFail = { get: new Set<string>(), remove: new Set<string>() };
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => { if (mockFail.get.has(k)) throw new Error('disk'); return mockStore.has(k) ? mockStore.get(k)! : null; },
    setItem: async (k: string, v: string) => { mockStore.set(k, v); },
    removeItem: async (k: string) => { if (mockFail.remove.has(k)) throw new Error('disk'); mockStore.delete(k); },
  },
}));

import { storageOwner } from '../storage';

const OWNER = 'hit_ai_storage_owner';
const KEYS = ['hit_ai_post_draft', 'hit_ai_posted_list', 'hit_ai_chat_cleared_before_id', 'hit_ai_disappear_ms'];

function seed(owner: string | null) {
  mockStore.clear();
  mockFail.get.clear();
  mockFail.remove.clear();
  if (owner !== null) mockStore.set(OWNER, owner);
  for (const k of KEYS) mockStore.set(k, 'v');
}
const values = () => KEYS.map((k) => (mockStore.has(k) ? mockStore.get(k)! : null));

describe('storageOwner.ensure', () => {
  it('(a) same owner keeps every key', async () => {
    seed('u1');
    await storageOwner.ensure('u1');
    expect(values().every((v) => v !== null)).toBe(true);
    expect(mockStore.get(OWNER)).toBe('u1');
  });

  it('(b) different owner clears the four keys and records the new owner', async () => {
    seed('u1');
    await storageOwner.ensure('u2');
    expect(values()).toEqual([null, null, null, null]);
    expect(mockStore.get(OWNER)).toBe('u2');
  });

  it('(c) no recorded owner adopts the existing data', async () => {
    seed(null);
    await storageOwner.ensure('u1');
    expect(values().every((v) => v !== null)).toBe(true);
    expect(mockStore.get(OWNER)).toBe('u1');
  });

  it('(d) one failing remove does not stop the others and still resolves', async () => {
    seed('u1');
    mockFail.remove.add('hit_ai_posted_list');
    await expect(storageOwner.ensure('u2')).resolves.toBeUndefined();
    expect(values()).toEqual([null, 'v', null, null]); // only the failed one survives
    expect(mockStore.get(OWNER)).toBe('u2');
  });

  it('(e) unreadable owner key clears nothing and resolves', async () => {
    seed('u1');
    mockFail.get.add(OWNER);
    await expect(storageOwner.ensure('u2')).resolves.toBeUndefined();
    expect(values().every((v) => v !== null)).toBe(true);
    expect(mockStore.get(OWNER)).toBe('u1');
  });

  it('ignores an empty user id', async () => {
    seed('u1');
    await storageOwner.ensure('');
    expect(mockStore.get(OWNER)).toBe('u1');
    expect(values().every((v) => v !== null)).toBe(true);
  });
});
