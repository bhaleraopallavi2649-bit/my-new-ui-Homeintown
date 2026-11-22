// Lightweight 1:1 chat embedded in the Lead Matching hub.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, BackHandler,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { registerHardwareBack } from '../lib/backGate';
import { bumpSessionUnread } from '../lib/chatUnread';
import { ChevronLeft, ChevronRight, Send, MessageSquare, CheckCheck } from '../icons';
import { chatApi, ChatSession, ChatMessage } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useSocket } from '../hooks/useSocket';
import { useToast } from './Toast';
import { colors } from '../theme';
// Flat green letter avatar (replaces the orange GradientCircle from AuthDecor).
function GreenCircle({ size, letter, fontSize }: { size: number; letter: string; fontSize: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1F4D3A', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize, fontWeight: '800' }}>{letter}</Text>
    </View>
  );
}
import { chatsErrorMessage, isChatsForbidden } from '../lib/roleRouting';
import { mergeFetchedMessages } from '../lib/messageMerge';

function timeStr(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function diffStr(iso: string) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

const initial = (name?: string) => (name || '?').charAt(0).toUpperCase();

// Warm-port palette constants. Hardcoded (not theme tokens) because they are the
// exact cream/beige shades from the reference chat screens, slightly off the
// nearest tokens (cream/line) by design.
const SUB = '#5F6C86';
const LINE = '#ECE5D8';
// Green theme (matches the Home / Properties page).
const GREEN = '#1F4D3A';
const GREEN_SOFT = '#E7F0EA';
const GREEN_BG = '#EAF8EE';

// Module-level so FlatList sees one stable component type instead of a new one
// on every parent render. Was a hairline divider; the reskin uses spaced cream
// cards, so the separator is now just a 10dp gap.
const SessionSeparator = () => <View style={{ height: 10 }} />;

const SessionRow = React.memo(function SessionRow({ session, partnerName, onPress }: {
  session: ChatSession;
  partnerName?: string;
  onPress: (session: ChatSession) => void;
}) {
  // The AI assistant is a service, so a green "online" dot is accurate for it.
  // People have no presence data, so no dot is drawn for them.
  const isAssistant = /assistant/i.test(partnerName || '');
  return (
    <Pressable onPress={() => onPress(session)} style={s.sessionRow}>
      <View>
        {/* Warm-port: was a flat brand circle with a letter; now the shared
            orange-gradient avatar from AuthDecor. */}
        <GreenCircle size={60} letter={initial(partnerName)} fontSize={26} />
        {isAssistant && <View style={s.onlineDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{partnerName || 'Unknown'}</Text>
        <Text style={s.lastMsg} numberOfLines={1}>{session.lastMessage || 'Start chatting'}</Text>
      </View>
      {session.unreadCount > 0 && (
        <View style={s.badge}><Text style={s.badgeText}>{session.unreadCount}</Text></View>
      )}
      <View style={s.timePill}><Text style={s.time}>{diffStr(session.updatedAt)}</Text></View>
      <ChevronRight size={22} color="#8B93A7" />
    </Pressable>
  );
});

const MessageRow = React.memo(function MessageRow({ msg, isMe }: {
  msg: ChatMessage;
  isMe: boolean;
}) {
  return (
    <View style={[s.msgRow, isMe ? s.msgRowMe : null]}>
      {!isMe && (
        <View style={s.avatarSmall}>
          <GreenCircle size={36} letter={initial(msg.sender.name)} fontSize={15} />
        </View>
      )}
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
        <Text style={[s.bubbleText, isMe && { color: '#fff' }]}>{msg.content}</Text>
        <View style={[s.metaRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
          <Text style={[s.bubbleTime, isMe && { color: '#E7F0EA' }]}>
            {timeStr(msg.createdAt)}
          </Text>
          {/* "Sent" tick: the message is on the server. There is no read-receipt
              data, so this does not claim the other person has read it. */}
          {isMe && <CheckCheck size={15} color='#CFE3D6' />}
        </View>
      </View>
    </View>
  );
});

export default function ChatEmbedded({ autoOpen = false, onExit }: {
  // Open a conversation straight away (the HIT AI Assistant one if present,
  // else the most recent) instead of showing the session list first.
  autoOpen?: boolean;
  // Called by the thread's back button when autoOpen is on, so the host can
  // return to its previous pane instead of showing the list.
  onExit?: () => void;
} = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const socket = useSocket();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  // D9: why the session list is empty, when it is because the load failed.
  const [sessionsError, setSessionsError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const flatRef = useRef<FlatList>(null);
  // New 1:1 chat picker (builders/agents from /chat/contacts).
  const [picking, setPicking] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string; phone: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  // user?.id is passed so the per-user unread entry can be read out of the
  // server's unreadCount map (it used to become NaN and no badge rendered).
  const loadSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      setSessions(await chatApi.getSessions(user?.id));
    } catch (e) {
      // D9: was `catch { /* silent */ }`, so a 403 (user/unassigned role) and a
      // network failure both read as "No conversations yet".
      setSessionsError({ message: chatsErrorMessage(e), forbidden: isChatsForbidden(e) });
    }
    finally { setLoadingSessions(false); }
  }, [user?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // socket.ready in the deps: re-subscribe once the socket exists. On a cold
  // start the first run was a silent no-op and live messages never arrived.
  useEffect(() => {
    const unsub = socket.onMessage((msg: any) => {
      const sid = msg.session || msg.sessionId;
      if (sid !== active?.id) return;
      setMessages(prev => [...prev, {
        id: String(msg._id || msg.id || Date.now()),
        sender: { id: String(msg.sender?._id || ''), name: msg.sender?.name || '', role: msg.sender?.role || '' },
        content: msg.content || '',
        messageType: msg.messageType || 'text',
        createdAt: msg.createdAt || new Date().toISOString(),
      }]);
      // The send path $incs our unread count server-side even while this
      // thread is open, so a message read live would come back as unread on the
      // next session load. Reset it now via the socket `mark_read` event.
      socket.markRead(sid);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [active?.id, socket.onMessage, socket.markRead, socket.ready]);

  // useCallback matters here: this is the onPress handed to every memoised
  // SessionRow. As a plain function it was rebuilt on each render, changing the
  // row's props and defeating the memo entirely. `activeIdRef` keeps the "leave
  // previous chat" behaviour without putting `active` in the dependency list.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = active?.id ?? null; }, [active?.id]);

  // Set synchronously on open (activeIdRef only follows after a render). A slow
  // getMessages for a chat the user already left used to land last and put the
  // old thread under the new header.
  const openingIdRef = useRef<string | null>(null);

  const openSession = useCallback(async (session: ChatSession) => {
    const previousId = activeIdRef.current;
    if (previousId) socket.leaveChat(previousId);
    openingIdRef.current = session.id;
    setActive(session);
    // Opening a thread reads it: clear the row's badge locally so going back to
    // the list does not show the old count until the next refetch.
    setSessions(prev => prev.map(x => (x.id === session.id ? { ...x, unreadCount: 0 } : x)));
    setMessages([]);
    setLoadingMsgs(true);
    socket.joinChat(session.id);
    try {
      const msgs = await chatApi.getMessages(session.id);
      if (openingIdRef.current !== session.id) return; // stale response
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 150);
    } catch { /* silent */ }
    finally { if (openingIdRef.current === session.id) setLoadingMsgs(false); }
    // Was chatApi.markRead → PUT /chat/sessions/:id/read, which does not exist
    // (404, swallowed). The socket `mark_read` event is the real reset path.
    socket.markRead(session.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.joinChat, socket.leaveChat, socket.markRead]);

  // D12: after a socket reconnect refetch the open thread and merge by id.
  // PREVIOUS BEHAVIOUR: messages sent while the socket was down never showed
  // until the thread was reopened. openingIdRef (cleared by closeThread) and
  // activeIdRef both guard against a thread the user already left.
  useEffect(() => socket.onReconnect(() => {
    const sid = openingIdRef.current;
    if (!sid || activeIdRef.current !== sid) return;
    chatApi.getMessages(sid)
      .then(fetched => {
        if (openingIdRef.current !== sid || activeIdRef.current !== sid) return;
        setMessages(prev => mergeFetchedMessages(prev, fetched));
        socket.markRead(sid);
      })
      .catch(() => { /* next reconnect or reopen tries again */ });
  }), [socket.onReconnect, socket.markRead]);

  // Live unread badge for rows other than the open thread (R27: the server
  // emits `notification` new_chat_message + sessionId to our personal room).
  useEffect(() => socket.onNotification((n: any) => {
    if (n?.type !== 'new_chat_message') return;
    setSessions(prev => bumpSessionUnread(prev, n.sessionId ? String(n.sessionId) : undefined, activeIdRef.current));
  }), [socket.onNotification, socket.ready]);

  // Header back and Android hardware back share one close path. Before, the
  // logic was inline on the header Pressable only, and hardware back with a
  // thread open left the screen instead of returning to the session list.
  // Focus-gated (useFocusEffect) so this screen, left mounted under a route
  // pushed from the Sidebar, does not swallow that route's back presses.
  const closeThread = () => {
    if (!active) return;
    openingIdRef.current = null;
    socket.leaveChat(active.id);
    // Direct-open mode: back leaves the chat entirely (host returns to Groups)
    // rather than dropping the user on a session list they never asked for.
    if (autoOpen && onExit) { onExit(); return; }
    setActive(null);
    setMessages([]);
  };
  const closeRef = useRef(closeThread);
  closeRef.current = closeThread;
  useFocusEffect(useCallback(
    () => registerHardwareBack(BackHandler, !!active, closeRef),
    [active?.id],
  ));

  const send = () => {
    if (!text.trim() || !active) return;
    // 1:1 send is socket-only. Previously, with no socket (offline cold start)
    // the emit was a no-op, and while disconnected it sat in socket.io's
    // buffer that is dropped once reconnect attempts run out — either way the
    // box was cleared and the message silently vanished. Keep the text and
    // say so instead.
    if (!socket.socket.current?.connected) {
      toast.show('Not connected. Message not sent.', 'error');
      return;
    }
    socket.sendMessage({ sessionId: active.id, content: text.trim() });
    setText('');
  };

  const getPartner = useCallback(
    (session: ChatSession) => session.participants.find(p => p.id !== user?.id),
    [user?.id]
  );

  // Direct open: once the sessions load, open the HIT AI Assistant conversation
  // (or the first one) a single time. With no sessions the normal empty state
  // shows instead.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current || loadingSessions || active || sessions.length === 0) return;
    autoOpenedRef.current = true;
    const target = sessions.find(x => /assistant/i.test(getPartner(x)?.name || '')) || sessions[0];
    openSession(target);
  }, [autoOpen, loadingSessions, sessions, active, getPartner, openSession]);
  const autoOpenPending = autoOpen && !autoOpenedRef.current && !active && (loadingSessions || sessions.length > 0);

  // Stable renderItem + separator. Both used to be inline arrows, so the session
  // list rebuilt every row on any parent render, and the separator was treated
  // as a brand-new component type each time (remounting all separators).
  const renderSession = useCallback(
    ({ item: session }: { item: ChatSession }) => (
      <SessionRow session={session} partnerName={getPartner(session)?.name} onPress={openSession} />
    ),
    [getPartner, openSession]
  );

  // The composer's `text` state lives in this component, so before memoisation
  // every keystroke re-rendered every message bubble in the thread.
  const renderMessage = useCallback(
    ({ item: msg }: { item: ChatMessage }) => (
      <MessageRow msg={msg} isMe={msg.sender.id === user?.id} />
    ),
    [user?.id]
  );

  const openPicker = () => {
    setPicking(true);
    setContactSearch('');
    if (contacts.length === 0) {
      setContactsLoading(true);
      chatApi.getContacts()
        .then(setContacts)
        .catch(() => toast.show("Couldn't load contacts", 'error'))
        .finally(() => setContactsLoading(false));
    }
  };
  const startWith = async (partnerId: string) => {
    if (startingId) return;
    setStartingId(partnerId);
    try {
      const sess = await chatApi.startChat(partnerId, user?.id);
      setSessions(prev => (prev.some(x => x.id === sess.id) ? prev : [sess, ...prev]));
      setPicking(false);
      openSession(sess);
    } catch {
      toast.show("Couldn't start chat. Try again.", 'error');
    } finally { setStartingId(null); }
  };

  if (!active && picking) {
    const q = contactSearch.trim().toLowerCase();
    const shown = q ? contacts.filter(c => `${c.name} ${c.role} ${c.phone}`.toLowerCase().includes(q)) : contacts;
    return (
      <View style={{ flex: 1, backgroundColor: GREEN_BG }}>
        <Pressable onPress={() => setPicking(false)} style={s.exitRow} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to chats">
          <ChevronLeft size={22} color={GREEN} />
          <Text style={s.exitText}>New chat</Text>
        </Pressable>
        <TextInput
          value={contactSearch}
          onChangeText={setContactSearch}
          placeholder="Search builders & agents"
          placeholderTextColor="#8B93A7"
          style={s.contactSearch}
        />
        {contactsLoading ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : shown.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>No contacts found</Text></View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={c => c.id}
            ItemSeparatorComponent={SessionSeparator}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item: c }) => (
              <Pressable onPress={() => startWith(c.id)} style={s.sessionRow} disabled={!!startingId}>
                <GreenCircle size={60} letter={initial(c.name)} fontSize={26} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{c.name || 'Unknown'}</Text>
                  <Text style={s.lastMsg} numberOfLines={1}>{c.role ? c.role.charAt(0).toUpperCase() + c.role.slice(1) : ''}</Text>
                </View>
                {startingId === c.id ? <ActivityIndicator color={GREEN} /> : <ChevronRight size={22} color="#8B93A7" />}
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  if (!active) {
    return (
      <View style={{ flex: 1, backgroundColor: GREEN_BG }}>
        {/* Direct-open mode with nothing to open (no sessions / load error):
            still give the user a way back to the host pane. */}
        {/* Back (left) and New chat (right) share one compact row. */}
        <View style={s.topRow}>
          {onExit && !autoOpenPending ? (
            <Pressable onPress={onExit} style={s.exitRow} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to groups">
              <ChevronLeft size={22} color={GREEN} />
              <Text style={s.exitText}>Back</Text>
            </Pressable>
          ) : <View />}
          {!autoOpen && (
            <Pressable onPress={openPicker} style={s.newChatBtn} accessibilityRole="button" accessibilityLabel="Start new chat">
              <Text style={s.newChatText}>+ New chat</Text>
            </Pressable>
          )}
        </View>
        {(loadingSessions || autoOpenPending) ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : sessionsError && sessions.length === 0 ? (
          <View style={s.empty}>
            <MessageSquare size={28} color={colors.muted} />
            <Text style={s.errorText} accessibilityRole="text">{sessionsError.message}</Text>
            {!sessionsError.forbidden && (
              <Pressable
                onPress={() => { setLoadingSessions(true); loadSessions(); }}
                style={s.retryBtn}
                accessibilityRole="button"
                accessibilityLabel="Retry loading conversations"
              >
                <Text style={s.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        ) : sessions.length === 0 ? (
          <View style={s.empty}>
            <MessageSquare size={28} color={colors.muted} />
            <Text style={s.emptyText}>No conversations yet</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={s => s.id}
            renderItem={renderSession}
            ItemSeparatorComponent={SessionSeparator}
            contentContainerStyle={{ padding: 14 }}
          />
        )}
      </View>
    );
  }

  const partner = getPartner(active);
  // The AI assistant is a service, so "Online" is accurate for it. For people
  // there is no presence data, so their role is shown instead of a guess.
  const isAssistant = /assistant/i.test(partner?.name || '');
  const roleLabel = partner?.role ? partner.role.charAt(0).toUpperCase() + partner.role.slice(1) : '';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: GREEN_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      {/* Warm-port: the header is now a floating cream card with the gradient
          avatar, name and an Online/role line (was a flat white bar). */}
      <View style={s.threadHeader}>
        <Pressable onPress={closeThread} style={{ padding: 4 }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={26} color={colors.ink} />
        </Pressable>
        <View>
          <GreenCircle size={54} letter={initial(partner?.name || '')} fontSize={24} />
          {isAssistant && <View style={s.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headName} numberOfLines={1}>{partner?.name || 'Unknown'}</Text>
          {isAssistant ? <Text style={s.statusText}>Online</Text> : roleLabel ? <Text style={s.statusText}>{roleLabel}</Text> : null}
        </View>
      </View>
      {loadingMsgs ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 14, gap: 14 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderMessage}
        />
      )}
      <View style={s.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Type a message…" placeholderTextColor={SUB}
          style={s.composerInput}
          multiline onSubmitEditing={send} />
        <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send message" style={[s.sendBtn, !text.trim() && { opacity: 0.7 }]}>
          <Send size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 14 },
  newChatBtn: { backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  newChatText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  contactSearch: { marginHorizontal: 14, minHeight: 46, borderWidth: 1, borderColor: LINE, borderRadius: 23, paddingHorizontal: 18, fontSize: 14, color: colors.ink, backgroundColor: '#FFFFFF' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: colors.muted },
  errorText: { fontSize: 13, color: colors.muted2, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: GREEN, marginTop: 4 },
  retryText: { fontSize: 13, fontWeight: '700', color: GREEN },
  exitRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10 },
  exitText: { fontSize: 15, fontWeight: '700', color: GREEN },
  // Warm-port: session rows are spaced cream cards (was a flat white row with a
  // hairline divider). The gradient avatar comes from GradientCircle, so the
  // old flat `avatar` / `avatarText` keys are gone.
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 14,
    // No card box around each chat: plain transparent row.
    backgroundColor: 'transparent',
  },
  avatarSmall: { marginRight: 8, alignSelf: 'flex-start' },
  onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 15, height: 15, borderRadius: 8, backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: GREEN_BG },
  msgRow: { flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  // Message bubbles — warm cream/peach surfaces (own = peach, them = cream).
  bubble: {
    maxWidth: '78%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20,
    shadowColor: '#3B3220', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  bubbleMe: { backgroundColor: GREEN, borderWidth: 1, borderColor: GREEN, borderBottomRightRadius: 6 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderTopLeftRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: colors.ink },
  bubbleTime: { fontSize: 12, color: SUB },
  headName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statusText: { fontSize: 14, color: colors.ink, marginTop: 2 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  timePill: { backgroundColor: GREEN_SOFT, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 3 },
  time: { fontSize: 12, fontWeight: '600', color: GREEN },
  lastMsg: { fontSize: 14.5, color: SUB, marginTop: 3 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: GREEN_BG, borderTopWidth: 1, borderTopColor: LINE },
  composerInput: { flex: 1, minHeight: 48, maxHeight: 110, borderWidth: 1, borderColor: LINE, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, fontSize: 15, color: colors.ink, backgroundColor: '#FFFFFF' },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  threadHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12,
    marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 20,
    // Transparent header: hairline outline only; no shadow (a shadow under a
    // see-through surface renders as a grey smear on Android).
    backgroundColor: 'transparent', borderWidth: 1, borderColor: LINE,
  },
});
