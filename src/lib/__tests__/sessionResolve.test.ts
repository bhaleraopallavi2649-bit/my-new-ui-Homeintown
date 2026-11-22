// P6-03 / P6-03b: the storage owner check runs BEFORE the user is committed,
// a stale resolution never commits, and the dashboard gate opens only after.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { commitAuthenticatedUser, isSessionReady } from '../sessionResolve';
import { storageOwner } from '../storage';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: any) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('commitAuthenticatedUser', () => {
  it('(f) commits only after ensure resolves, with the same object', async () => {
    const d = deferred();
    const commit = jest.fn();
    const user = { id: 'u1', role: 'builder' };
    const p = commitAuthenticatedUser(user, () => d.promise, commit);
    await flush();
    expect(commit).toHaveBeenCalledTimes(0);
    d.resolve();
    await expect(p).resolves.toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toBe(user);
  });

  it('(g) an ensure failure still commits and resolves', async () => {
    const commit = jest.fn();
    await expect(commitAuthenticatedUser({ id: 'u1' }, async () => { throw new Error('x'); }, commit)).resolves.toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('(h) a stale resolution does not commit', async () => {
    const commit = jest.fn();
    await expect(commitAuthenticatedUser({ id: 'u1' }, async () => {}, commit, () => false)).resolves.toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  describe('with the real storageOwner.ensure', () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
      await AsyncStorage.setItem('hit_ai_storage_owner', 'u1');
      await AsyncStorage.setItem('hit_ai_post_draft', '{"t":"A draft"}');
      await AsyncStorage.setItem('hit_ai_posted_list', '[{"id":"a"}]');
    });

    it('(i) account switch: keys are already gone when commit runs', async () => {
      let seen: (string | null)[] = [];
      await commitAuthenticatedUser({ id: 'u2' }, storageOwner.ensure, async () => {
        seen = [await AsyncStorage.getItem('hit_ai_post_draft'), await AsyncStorage.getItem('hit_ai_posted_list')];
      });
      // The commit callback above is async only to read; ordering is what matters.
      await flush();
      expect(seen).toEqual([null, null]);
    });

    it('(j) same user: keys are still there when commit runs', async () => {
      let seen: (string | null)[] = [];
      await commitAuthenticatedUser({ id: 'u1' }, storageOwner.ensure, async () => {
        seen = [await AsyncStorage.getItem('hit_ai_post_draft'), await AsyncStorage.getItem('hit_ai_posted_list')];
      });
      await flush();
      expect(seen).toEqual(['{"t":"A draft"}', '[{"id":"a"}]']);
    });
  });
});

describe('isSessionReady', () => {
  it('(k) needs a user id and a signed-in status', () => {
    expect(isSessionReady('loading', { id: 'u1' })).toBe(false);
    expect(isSessionReady('authenticated', null)).toBe(false);
    expect(isSessionReady('authenticated', {})).toBe(false);
    expect(isSessionReady('authenticated', { id: 'u1' })).toBe(true);
    expect(isSessionReady('unassigned', { id: 'u1' })).toBe(true);
    expect(isSessionReady('unauthenticated', { id: 'u1' })).toBe(false);
  });

  it('(l) the gate stays closed while ensure is pending and opens after commit', async () => {
    const d = deferred();
    let status = 'loading';
    let user: { id: string } | null = null;
    const p = commitAuthenticatedUser({ id: 'u1' }, () => d.promise, (u) => { user = u; status = 'authenticated'; });
    await flush();
    expect(isSessionReady(status, user)).toBe(false);
    d.resolve();
    await p;
    expect(isSessionReady(status, user)).toBe(true);
  });

  it('(m) a logout during a pending switch (generation bump) prevents the late commit', async () => {
    let gen = 0;
    const d = deferred();
    const commit = jest.fn();
    const myGen = ++gen;
    const p = commitAuthenticatedUser({ id: 'u2' }, () => d.promise, commit, () => myGen === gen);
    gen++; // logout's finally
    d.resolve();
    await expect(p).resolves.toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
});
