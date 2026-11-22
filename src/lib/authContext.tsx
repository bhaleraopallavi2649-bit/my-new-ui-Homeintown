import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { authApi, AuthUser, clearSessionCaches } from './api';
import { disconnectSocket } from './socket';
import { storageOwner } from './storage';
import { commitAuthenticatedUser } from './sessionResolve';
import { setSessionExpiredHandler } from './api';
import { createSessionExpiryGate } from './sessionExpiry';
import { useToast } from '../components/Toast';
import { nextSessionAction } from './sessionRetry';

export type User = AuthUser;

// Retry budget for a rate-limited session check. Bounded so the app can never
// sit on the splash forever, and the delay is clamped because the server's
// Retry-After can be the whole 15-minute window (far too long to stall on) or
// a single second (which would just hammer an already-limited bucket).
const MAX_RATE_LIMIT_RETRIES = 3;
const RETRY_DELAY_MIN_MS = 5000;
const RETRY_DELAY_MAX_MS = 30000;

interface AuthContextType {
  user: User | null;
  // 'offline' (D3): the server could not be reached after bounded retries; the
  // stored token is kept and the UI shows a Retry screen, not the login screen.
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'unassigned' | 'offline';
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  // ToastProvider wraps AuthProvider in app/_layout.tsx, so the hook is valid
  // here. Held in a ref so the session-expiry effect does not re-register on
  // every toast context change.
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const expiryGateRef = useRef<ReturnType<typeof createSessionExpiryGate> | null>(null);

  // Attempt counter lives in a ref, not state, so a retry never re-renders and
  // an explicit checkAuth() (e.g. from the login screen) can reset the budget.
  const rateLimitAttempts = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // D3: separate budget for network/5xx failures (sessionRetry.ts).
  const transientAttempts = useRef(0);

  // P6-03: generation counter for user resolution. Every session check, account
  // switch via setUser and logout bumps it; a resolution that finishes after a
  // newer one started (it awaits storageOwner.ensure first) is dropped instead
  // of overwriting the newer state — e.g. a late check committing a user after
  // logout already ran.
  const authGenRef = useRef(0);
  // Id of the user currently committed, so setUser can tell a profile refresh
  // (same id, stays synchronous) from an account switch (different id).
  const userIdRef = useRef<string | null>(null);

  // Commit a resolved user + its status. One place, so userIdRef never drifts.
  const commitUser = useCallback((u: User) => {
    userIdRef.current = u.id || null;
    setUserState(u);
    setStatus(u.role === 'unassigned' ? 'unassigned' : 'authenticated');
  }, []);

  const runSessionCheck: () => Promise<void> = useCallback(async () => {
    const gen = ++authGenRef.current;
    try {
      setStatus('loading');
      const session = await authApi.getSession();

      // Rate limited: the session is probably fine, we just could not ask. The
      // old code dropped straight to 'unauthenticated' here, which _layout.tsx
      // turns into router.replace('/login') — a 429 logged the user out. Stay on
      // 'loading' instead (both app/index.tsx and app/_layout.tsx treat it as
      // "do nothing yet", so nothing routes anywhere) and ask again shortly.
      // The token is deliberately NOT cleared on this path.
      if (session.rateLimited && rateLimitAttempts.current < MAX_RATE_LIMIT_RETRIES) {
        rateLimitAttempts.current += 1;
        const delay = Math.min(
          RETRY_DELAY_MAX_MS,
          Math.max(RETRY_DELAY_MIN_MS, (session.retryAfterSeconds || 0) * 1000),
        );
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => { runSessionCheck(); }, delay);
        return;
      }
      // Attempts exhausted → fall through to the old behaviour below, so the
      // screen resolves to the login flow rather than hanging indefinitely.

      // D3: network error / timeout / 5xx. PREVIOUS BEHAVIOUR: getSession
      // reported these as authenticated: false, so an offline cold start went
      // to /login with a valid token still stored. Retry a bounded number of
      // times (still 'loading', nothing routes), then settle on 'offline'. The
      // token is never cleared here.
      if (!session.rateLimited) {
        const next = nextSessionAction(session, transientAttempts.current);
        if (next.kind === 'retry') {
          transientAttempts.current += 1;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => { runSessionCheck(); }, next.delayMs);
          return;
        }
        if (next.kind === 'offline') {
          if (gen === authGenRef.current) setStatus('offline');
          return;
        }
      }

      if (session.authenticated && session.user) {
        // P6-03: used to set user + status directly. The per-user AsyncStorage
        // owner check now runs FIRST, so a different account's AI Assist keys
        // are gone before any dashboard screen can mount and read them.
        await commitAuthenticatedUser(session.user, storageOwner.ensure, commitUser, () => gen === authGenRef.current);
      } else {
        userIdRef.current = null;
        setUserState(null);
        setStatus('unauthenticated');
      }
    } catch {
      userIdRef.current = null;
      setUserState(null);
      setStatus('unauthenticated');
    }
  }, [commitUser]);

  const checkAuth = useCallback(async () => {
    // An explicit call is a fresh intent (mount, or the login screen after a
    // successful sign-in), so the rate-limit retry budget starts over and any
    // pending retry is dropped.
    rateLimitAttempts.current = 0;
    transientAttempts.current = 0;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    await runSessionCheck();
  }, [runSessionCheck]);

  useEffect(() => {
    checkAuth();
    // Never leave a retry timer running after unmount.
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [checkAuth]);

  // setUser / logout were plain functions and the value an inline object, so
  // every AuthProvider render handed every useAuth() consumer (most screens) a
  // new context value and new function identities — re-rendering them all and
  // re-firing any effect that listed setUser/logout as a dependency. The value
  // now changes only when user or status actually change.
  const setUser = useCallback((u: User | null) => {
    if (!u) {
      userIdRef.current = null;
      setUserState(null);
      setStatus('unauthenticated');
      return;
    }
    // Today's only callers are profile.tsx refreshing /users/me and
    // /users/profile — both "me" endpoints, so a payload that somehow lacks an
    // id is still the current user. Keep the known id instead of letting the
    // dashboard gate (isSessionReady needs an id) unmount everything.
    const next = !u.id && userIdRef.current ? { ...u, id: userIdRef.current } : u;
    if (!next.id || next.id === userIdRef.current) {
      // Same user (profile refresh): synchronous, exactly as before.
      commitUser(next);
      return;
    }
    // P6-03b: a DIFFERENT user. Go through 'loading' so the dashboard gate
    // unmounts, run the storage owner check, then commit (dashboard remounts
    // fresh for the new user). Previously this committed immediately.
    const gen = ++authGenRef.current;
    setStatus('loading');
    commitAuthenticatedUser(next, storageOwner.ensure, commitUser, () => gen === authGenRef.current);
  }, [commitUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // A session check / account switch still awaiting its storage owner
      // check must not commit a user after this logout (P6-03).
      authGenRef.current++;
      userIdRef.current = null;
      // Disconnect the socket so a new login starts a fresh session
      try { disconnectSocket(); } catch { /* ignore */ }
      // Logout used to leave the in-memory response caches (leads list, match
      // counts, public projects, project detail) alive for the next account.
      try { clearSessionCaches(); } catch { /* ignore */ }
      setUserState(null);
      setStatus('unauthenticated');
    }
  }, []);

  // D10: a 401 on any protected call means the token is dead. PREVIOUS
  // BEHAVIOUR: nothing reacted to it, so the user stayed in a dashboard where
  // every request failed. Route it through the existing logout (token clear,
  // socket disconnect, clearSessionCaches, authGen bump) exactly once, however
  // many requests 401 in parallel. Ignored while nobody is signed in, so a stale
  // token on cold start or the login screen never shows the toast.
  //
  // Review F2: before logging out, confirm the CURRENT stored token is the dead
  // one (authApi.isSessionRejected). PREVIOUS BEHAVIOUR: a slow request from
  // account A that 401'd after B signed in logged B out. The gen/user check
  // drops the result if a login, switch or logout happened while it ran.
  useEffect(() => {
    const confirmDead = async () => {
      const gen = authGenRef.current;
      const dead = await authApi.isSessionRejected();
      return dead && gen === authGenRef.current && !!userIdRef.current;
    };
    const gate = createSessionExpiryGate(async () => {
      await logout();
      toastRef.current.show('Session expired, please log in again', 'error');
    }, confirmDead);
    expiryGateRef.current = gate;
    const unregister = setSessionExpiredHandler(() => {
      if (userIdRef.current) gate.trigger();
    });
    return () => {
      unregister();
      if (expiryGateRef.current === gate) expiryGateRef.current = null;
    };
  }, [logout]);

  // Re-arm the gate for each newly signed-in user.
  useEffect(() => {
    if (user?.id) expiryGateRef.current?.reset();
  }, [user?.id]);

  const value = useMemo(
    () => ({ user, status, setUser, logout, checkAuth }),
    [user, status, setUser, logout, checkAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
