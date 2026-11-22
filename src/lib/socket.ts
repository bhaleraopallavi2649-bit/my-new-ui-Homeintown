// Socket.io client for HomeInTown Mobile.
// The server accepts the JWT via socket.handshake.auth.token (same token
// used for REST Bearer auth — no cookie needed on mobile).

import { io, Socket } from 'socket.io-client';
import { AppState } from 'react-native';
import { API_URL } from './api';
import { tokenStorage } from './storage';
import { shouldResumeSocket } from './socketResume';
import { createReconnectTracker } from './reconnectTracker';

// Base URL = API_URL without the "/api" suffix
const WS_URL = API_URL.replace(/\/api$/, '');

let _socket: Socket | null = null;
// One AppState listener per socket lifetime; removed in disconnectSocket().
let appStateSub: { remove(): void } | null = null;

// Rooms this client believes it is in.
//
// Server-side room membership belongs to the SOCKET, not the user — so after any
// reconnect the new socket is in no rooms at all. Nothing used to re-emit
// join_group/join_chat, which meant that after a brief network blip incoming
// messages stopped arriving for the rest of the session while the UI still
// looked healthy (REST sends kept working, so it read as "my messages send but
// I never receive"). Tracking membership here and replaying it on every
// 'connect' fixes it once for every consumer.
const joinedGroups = new Set<string>();
const joinedChats = new Set<string>();

// D12: rejoinAll gets rooms back after a reconnect, but messages sent while the
// socket was down were never fetched, so the open thread silently had a gap.
// Listeners registered here run on every REconnect (not the first connect),
// after the rooms are rejoined, so a screen can refetch what it has open.
// AppState resume reconnects through the same 'connect' event.
const reconnectTracker = createReconnectTracker();
const reconnectListeners = new Set<() => void>();
export function onSocketReconnect(cb: () => void): () => void {
  reconnectListeners.add(cb);
  return () => { reconnectListeners.delete(cb); };
}

function rejoinAll(s: Socket) {
  for (const roomId of joinedGroups) s.emit('join_group', roomId);
  for (const sessionId of joinedChats) s.emit('join_chat', sessionId);
}

/** Record + emit a group join, so it survives reconnects. */
export function trackJoinGroup(roomId: string) {
  if (!roomId) return;
  joinedGroups.add(roomId);
  _socket?.emit('join_group', roomId);
}

export function trackLeaveGroup(roomId: string) {
  if (!roomId) return;
  joinedGroups.delete(roomId);
  _socket?.emit('leave_group', roomId);
}

export function trackJoinChat(sessionId: string) {
  if (!sessionId) return;
  joinedChats.add(sessionId);
  _socket?.emit('join_chat', sessionId);
}

export function trackLeaveChat(sessionId: string) {
  if (!sessionId) return;
  joinedChats.delete(sessionId);
  _socket?.emit('leave_chat', sessionId);
}

export async function getSocket(): Promise<Socket> {
  if (_socket && _socket.connected) return _socket;

  const token = await tokenStorage.get();

  if (_socket) {
    // Update auth token and reconnect
    _socket.auth = { token };
    _socket.connect();
    return _socket;
  }

  // Was 5 attempts with the default backoff and no foreground hook, so a
  // ~30 s outage left the socket dead until the app was killed. Now 10
  // attempts capped at 5 s apart (~45 s window), and every return to the
  // foreground starts a fresh attempt budget (below). Still bounded: in the
  // background retries stop after the cap instead of looping forever.
  _socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 20000,
  });

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (st) => {
      // Reuses the same socket (never creates one), so rooms and listeners
      // survive and rejoinAll runs on the resulting 'connect'.
      if (shouldResumeSocket(st, _socket)) _socket!.connect();
    });
  }

  _socket.on('connect', () => {
    // Connect/disconnect logs are dev-only now; release builds used to write
    // the socket id to logcat on every (re)connect.
    if (__DEV__) console.log('[Socket] connected', _socket?.id);
    // Fires on the initial connect AND on every automatic reconnect.
    if (_socket) rejoinAll(_socket);
    if (reconnectTracker.onConnect()) {
      reconnectListeners.forEach((cb) => {
        try { cb(); } catch { /* a listener error never breaks the socket */ }
      });
    }
  });
  _socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('[Socket] disconnected', reason);
  });
  _socket.on('error', (err) => console.warn('[Socket] error', err));

  return _socket;
}

export function disconnectSocket() {
  // Logout: a foreground resume must not reconnect a socket that belongs to
  // the previous session.
  appStateSub?.remove();
  appStateSub = null;
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  joinedGroups.clear();
  joinedChats.clear();
  // Next login's first connect must not count as a reconnect. Listeners belong
  // to mounted components and remove themselves on unmount.
  reconnectTracker.reset();
}
