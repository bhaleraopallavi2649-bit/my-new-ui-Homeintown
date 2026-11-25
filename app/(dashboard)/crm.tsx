// Home Dashboard.
// Top navbar (menu + logo + tagline + upload) → warm welcome card (greeting +
// views/leads, AI Lead Matching tab only) → the Lead Matching / AI / CRM /
// Project switcher, which swaps between four embedded screens: LeadMatchingHub,
// AiAssistant (the AI segment — the HIT AI Assistant chat), CrmLeadsScreen and
// the PropertyMap.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, BackHandler, Modal, TextInput, Animated, Easing, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Menu, Plus, BarChart3, Home, Users, Search, MessageCircle, Tag, KeyRound, Zap, MapIcon,
  Building2, Target, UserPlus, GraduationCap, Upload,
} from '../../src/icons';
import { HG } from '../../src/components/PropertiesHome';
import AiAssistant from '../../src/components/AiAssistant';
import {
  crmBridgeApi, CrmAnalytics, analyticsApi,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/authContext';
import { useSidebar } from '../../src/lib/sidebarContext';
import { colors, FLOAT_NAV_HEIGHT } from '../../src/theme';
import { FloatTopContext, FloatBottomContext } from '../../src/lib/floatChrome';
import { PageBackdrop } from '../../src/components/AuthDecor';
// Reused screens rendered as embedded tab content (no duplication).
import CrmLeadsScreen from './crm-leads';
import LeadMatchingHub from './lead-matching';
import PropertyMap from '../../src/components/PropertyMap';

// 'marketplace' is the Project segment. The name is historical — the segment was
// a marketplace before it became the map — and is kept (decision 4a) because
// renaming it would touch every reference for no behavioural gain.
// 'chat' is the AI segment: it now renders AiAssistant directly (the HIT AI
// Assistant slot-filling chat) so tapping "AI" opens that interface straight
// away. It used to render ChatEmbedded, the conversation list, which forced a
// second tap into the assistant conversation — the user asked for the assistant
// to open directly.
// 'ai' = Lead Match (AI Lead Matching assistant chat, no sub-row).
// 'mygroup' = My Group: the same hub opened on its Groups pane, with the
//   Chats / My Post / Matching action pills shown.
// 'home' = the Properties landing page (PropertiesHome). It replaced the old
//   "Lead Match" entry point; the AI assistant ('ai') is now reached from its
//   "Ask AI" link, and the Project map ('marketplace') from its "Map View" chip.
type OverviewTab = 'leadmatch' | 'ai' | 'mygroup' | 'chat' | 'crm' | 'marketplace';

// One item of the fixed bottom navigation (Home · My Group · CRM).
function BottomNavItem({ active, icon, label, badge, onPress }: {
  active: boolean;
  icon: (color: string) => React.ReactNode;
  label: string;
  badge?: boolean;
  onPress: () => void;
}) {
  const color = active ? HG.green : '#5E6661';
  return (
    <Pressable
      style={({ pressed }) => [s.navItem, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
      hitSlop={4}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {/* Icon only (no text label); the label stays as the accessibility name. */}
      <View style={s.navIconWrap}>
        {icon(color)}
        {badge && <View style={s.hotDotInline} />}
      </View>
      {/* Label under the icon; the active tab is green and bold. */}
      <Text style={[s.navLabel, { color }, active && { fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ── Animated My Post / Matching segmented toggle ──
// Sliding green indicator like the Lead Match / My Group tab row.
function LmPostMatchToggle({ lmBadge, onPost, onMatch }: {
  lmBadge: number; onPost: () => void; onMatch: () => void;
}) {
  const [active, setActive] = React.useState<'post' | 'match'>('post');
  const slideX = React.useRef(new Animated.Value(0)).current;
  const TAB_W = 0; // measured at runtime
  const [trackW, setTrackW] = React.useState(0);

  const switchTo = (tab: 'post' | 'match') => {
    if (active === tab) {
      if (tab === 'post') onPost(); else onMatch();
      return;
    }
    setActive(tab);
    Animated.timing(slideX, {
      toValue: tab === 'post' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => { if (tab === 'post') onPost(); else onMatch(); });
  };

  const indicatorLeft = slideX.interpolate({
    inputRange: [0, 1], outputRange: [2, (trackW / 2) + 2],
  });

  return (
    <View
      style={lt.track}
      onLayout={e => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[lt.indicator, { left: indicatorLeft, width: trackW / 2 - 4 }]} />
      {(['post', 'match'] as const).map(tab => {
        const isActive = active === tab;
        const countBadge = tab === 'match' && lmBadge > 0;
        const label = tab === 'post' ? 'My Post' : 'Matching';
        const Icon = tab === 'post' ? Building2 : Target;
        return (
          <Pressable
            key={tab}
            style={({ pressed }) => [lt.btn, pressed && { opacity: 0.75 }]}
            onPress={() => switchTo(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <Icon size={13} color={isActive ? HG.green : '#6B8F7B'} strokeWidth={isActive ? 2.4 : 1.8} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[lt.txt, isActive && lt.txtActive]} numberOfLines={1}>{label}</Text>
              {countBadge && (
                <View style={lt.redBadge}>
                  <Text style={lt.redBadgeTxt}>{lmBadge > 99 ? '99+' : lmBadge}</Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
const lt = StyleSheet.create({
  track: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: 4, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(31,77,58,0.12)',
    overflow: 'hidden', position: 'relative',
  },
  indicator: {
    position: 'absolute', top: 2, bottom: 2, borderRadius: 10,
    backgroundColor: '#E7F0EA',
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 6, zIndex: 1,
  },
  txt: { fontSize: 11, fontWeight: '600', color: '#6B8F7B' },
  txtActive: { color: '#1F4D3A', fontWeight: '800' },
  redBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  redBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
});

export default function HomeDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();

  const [analytics, setAnalytics] = useState<CrmAnalytics | null>(null);
  const [stats, setStats] = useState({ views: 0, leads: 0 });
  const [loading, setLoading] = useState(true);
  // Active Overview tab — AI Lead Matching is the default view.
  // Home (Properties) is the default landing tab.
  // Lead Match is the landing tab (Home was removed).
  const [tab, setTab] = useState<OverviewTab>('leadmatch');
  // Tab switch transition: the new tab slides in from the side of the tapped
  // footer button (right → left when moving right, left → right when moving
  // left) with a short fade. Native driver, ~220ms.
  const TAB_ORDER: OverviewTab[] = ['leadmatch', 'mygroup', 'crm', 'marketplace', 'ai', 'chat'];
  const tabX = useRef(new Animated.Value(0)).current;
  const tabFade = useRef(new Animated.Value(1)).current;
  const prevTabRef = useRef<OverviewTab>(tab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = tab;
    if (prev === tab) return;
    const dir = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prev) ? 1 : -1;
    tabX.setValue(dir * 48);
    tabFade.setValue(0.35);
    Animated.parallel([
      Animated.timing(tabX, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tabFade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  // True while an AI Lead Matching conversation is active → hide the welcome banner.
  const [, setChatActive] = useState(false);
  // Bumped on every "AI Leads" tap so the hub returns to its default landing page.
  const [aiResetKey, setAiResetKey] = useState(0);
  // Bumped on each Lead Match tap so the hub returns to its landing view.
  const [leadMatchReset, setLeadMatchReset] = useState(0);
  // Project to centre the map on when switching to the Project tab via a card's
  // "View Property" button. Bumped (cleared then set) so the same property can be
  // re-focused on a second tap.
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const viewPropertyOnMap = (projectId: string) => {
    setFocusProjectId(null);
    // Next tick so the focus effect sees a fresh value even for the same id.
    setTimeout(() => setFocusProjectId(projectId || null), 0);
    setTab('marketplace');
  };
  // Other screens (Projects, Marketplace) send the user here with
  // ?mapProject=<id>&mapNonce=<n> so "View Project" lands on that property in the
  // map. The nonce makes a second tap on the same property fire again.
  const { mapProject, mapNonce } = useLocalSearchParams<{ mapProject?: string; mapNonce?: string }>();
  useEffect(() => {
    if (mapProject) viewPropertyOnMap(String(mapProject));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapProject, mapNonce]);

  // Agents can also list/upload projects (backend ProjectController.create allows
  // builder/agent/admin/captain), so include 'agent' here to match permissions.
  const canUpload = ['admin', 'builder', 'captain', 'agent'].includes(user?.role ?? '');

  // Two requests, both for the chrome this screen owns: the welcome card's
  // views/leads totals and the CRM segment's hot-lead dot. The tab contents fetch
  // their own data.
  //
  // This used to also pull the full public project list and then a match count
  // for every project in it — a second copy of a list the Project tab fetches
  // anyway — to feed a property-reels section that had been switched off with
  // `{false && ...}`. Both requests went out on every dashboard open.
  const load = useCallback(async () => {
    try {
      const [overview, crm] = await Promise.allSettled([
        analyticsApi.overview(),
        crmBridgeApi.getAnalytics(),
      ]);

      if (overview.status === 'fulfilled' && Array.isArray(overview.value)) {
        const views = overview.value.reduce((s: number, p: any) => s + (p.totalVisits || 0), 0);
        const leads = overview.value.reduce((s: number, p: any) => s + (p.uniqueLeads || 0), 0);
        setStats({ views, leads });
      }

      if (crm.status === 'fulfilled') setAnalytics(crm.value);
    } catch { /* silent — the banner just shows placeholders */ }
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const crmHot = analytics?.hot ?? 0;

  // Map View and Ask AI are sub-screens of Home: the bottom nav keeps Home
  // highlighted there, and a small back bar returns to the property list.

  // CRM header search icon toggles the lead search fields.
  const [crmSearch, setCrmSearch] = useState(false);
  // My Group header search icon toggles the Groups search field.
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);
  // CRM header New Lead / Learn icons drive CrmLeadsScreen via signals.
  const [crmAddSignal, setCrmAddSignal] = useState(0);
  const [crmLearnSignal, setCrmLearnSignal] = useState(0);
  const [crmMode, setCrmMode] = useState<'ai' | 'human' | 'course'>('human');
  // Lead Match header search (filters the property cards).
  const [lmSearchOpen, setLmSearchOpen] = useState(false);
  const [lmQuery, setLmQuery] = useState('');
  // Ask AI (chat icon) first shows a Buy / Sell / Rent popup; the choice is
  // handed to the assistant once it is ready.
  const [showIntentPicker, setShowIntentPicker] = useState(false);
  const pendingIntentRef = useRef<'buy' | 'sell' | 'rent' | null>(null);
  const startAi = (intent: 'buy' | 'sell' | 'rent') => {
    pendingIntentRef.current = intent;
    setShowIntentPicker(false);
    setAiResetKey((k) => k + 1);
    setTab('ai');
  };

  // Android back on any tab other than Lead Match returns to Lead Match (the
  // landing tab) instead of leaving the app.
  useEffect(() => {
    if (tab === 'leadmatch') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setTab('leadmatch');
      return true;
    });
    return () => sub.remove();
  }, [tab]);
  const goUpload = () => router.push('/(dashboard)/add-project' as any);
  // My Post / Matching triggers + match count published by the Lead Match hub,
  // shown as boxless header icons next to HomeInTown.
  const lmActionsRef = useRef<{ post: () => void; matching: () => void } | null>(null);
  const handleLmActions = useCallback((a: { post: () => void; matching: () => void }) => { lmActionsRef.current = a; }, []);
  const [lmMatchCount, setLmMatchCount] = useState<number | null>(null);
  const handleLmMatchCount = useCallback((n: number | null) => setLmMatchCount(n), []);
  // With an intent (Buy / Sell / Rent buttons, card Chat) the chat opens at once;
  // without one the Buy / Sell / Rent popup is shown.
  const startAiRef = useRef(startAi);
  startAiRef.current = startAi;
  const openAskAI = useCallback((intent?: 'buy' | 'sell' | 'rent') => {
    if (intent) startAiRef.current(intent);
    else setShowIntentPicker(true);
  }, []);
  const lmBadge = typeof lmMatchCount === 'number' && lmMatchCount > 0 ? lmMatchCount : 0;
  // My Group reports when a group chat is open (its composer must stay above
  // the floating nav).
  const [groupRoomOpen, setGroupRoomOpen] = useState(false);
  // Floating header: measured height -> space the content leaves above it.
  const [headerH, setHeaderH] = useState(58);
  const floatTop = insets.top + 6 + headerH + 8;
  // Lead Match / My Group / CRM scroll behind the header (their lists add
  // floatTop as top padding); other tabs simply start below it.
  const usesFloatTop = tab === 'leadmatch' || tab === 'mygroup' || tab === 'crm';
  // The footer is a normal full-width bar now (not floating), so the content
  // area already ends above it and needs no extra bottom padding.
  const contentPad = 0;
  // Lead Match no longer uses a floating footer — the footer is always a fixed bar.
  const floatingFooter = false;
  const [kbVisible, setKbVisible] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const floatBottom = 0;

  return (
    <View style={s.root}>
      {/* App-wide mint background behind every tab. */}
      <PageBackdrop />

      {/* ── Floating header (rounded translucent pill, like the footer) ──
          Absolutely positioned over the content: on Lead Match / My Group /
          CRM the lists scroll behind it (they start below it via
          FloatTopContext); other tabs are pushed below it. Its height is
          measured so the Lead Match search row is included when open. */}
      <View
        pointerEvents="box-none"
        style={[s.floatHeaderWrap, { top: insets.top + 6 }]}
        onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); setHeaderH((v) => (v === h ? v : h)); }}
      >

      {/* ── Top Navbar — shown on every tab ── */}
      {(tab === 'mygroup' || tab === 'crm' || tab === 'chat' || tab === 'ai' || tab === 'leadmatch' || tab === 'marketplace') && (
      <View style={s.navbar}>
        <View style={s.navLeft}>
          <Pressable onPress={openSidebar} hitSlop={8} style={s.menuBtn}>
            <Menu size={24} color={colors.ink} />
          </Pressable>
          <View style={s.logoBox}><Home size={24} color={HG.green} strokeWidth={2.4} /></View>
          <Text style={s.brandName} numberOfLines={1}>HomeInTown</Text>
        </View>
        {/* Header actions: transparent icons with small labels, no boxes. */}
        {/* (was: Lead Match / My Group / CRM: the header actions sit in one rounded
            translucent pill — removed, the whole header is the pill now) */}
        <View style={s.navRight}>
          {/* Lead Match: Search · Upload as boxless icons (My Post/Matching moved to toggle row below tabs) */}
          {tab === 'leadmatch' && (
            <>
              <Pressable
                style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]}
                onPress={() => { if (lmSearchOpen) setLmQuery(''); setLmSearchOpen((v) => !v); }}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={lmSearchOpen ? 'Close property search' : 'Search properties'}
              >
                <Search size={19} color={HG.green} strokeWidth={lmSearchOpen ? 2.8 : 2.2} />
                <Text style={[s.hdrActText, lmSearchOpen && { textDecorationLine: 'underline' }]}>Search</Text>
              </Pressable>
              {canUpload && (
                <Pressable style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]} onPress={goUpload} hitSlop={4} accessibilityRole="button" accessibilityLabel="Upload">
                  <View style={s.uploadCircle}>
                    <Upload size={17} color="#fff" strokeWidth={2.4} />
                  </View>
                </Pressable>
              )}
            </>
          )}
          {/* CRM only: search icon beside "+", toggles the lead search. */}
          {/* CRM: New Lead and Learn (icon + small label) before Search. */}
          {tab === 'crm' && (
            <>
              <Pressable style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]} onPress={() => setCrmAddSignal((n) => n + 1)} hitSlop={4} accessibilityRole="button" accessibilityLabel="New lead">
                <UserPlus size={19} color={HG.green} strokeWidth={2.2} />
                <Text style={s.hdrActText}>New Lead</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]} onPress={() => setCrmLearnSignal((n) => n + 1)} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: crmMode === 'course' }} accessibilityLabel="Learn about lead qualification">
                <GraduationCap size={19} color={HG.green} strokeWidth={crmMode === 'course' ? 2.8 : 2.2} />
                <Text style={[s.hdrActText, crmMode === 'course' && { textDecorationLine: 'underline' }]}>Learn</Text>
              </Pressable>
            </>
          )}
          {/* CRM search: transparent icon + small label, like its neighbours. */}
          {tab === 'crm' && (
            <Pressable
              style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]}
              onPress={() => setCrmSearch((v) => !v)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={crmSearch ? 'Close lead search' : 'Search leads'}
            >
              <Search size={19} color={HG.green} strokeWidth={crmSearch ? 2.8 : 2.2} />
              <Text style={[s.hdrActText, crmSearch && { textDecorationLine: 'underline' }]}>Search</Text>
            </Pressable>
          )}
          {/* Project (map): Lead Upload moved here from the footer. */}
          {tab === 'marketplace' && canUpload && (
            <Pressable
              style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]}
              onPress={goUpload}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Lead Upload"
            >
              <Upload size={19} color={HG.green} strokeWidth={2.2} />
              <Text style={s.hdrActText}>Upload</Text>
            </Pressable>
          )}
          {/* My Group: transparent search icon on the right of the header. */}
          {tab === 'mygroup' && (
            <Pressable
              style={({ pressed }) => [s.hdrAct, pressed && s.hdrActPressed]}
              onPress={() => setGroupSearchOpen((v) => !v)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={groupSearchOpen ? 'Close group search' : 'Search groups'}
            >
              <Search size={19} color={HG.green} strokeWidth={groupSearchOpen ? 2.8 : 2.2} />
              <Text style={[s.hdrActText, groupSearchOpen && { textDecorationLine: 'underline' }]}>Search</Text>
            </Pressable>
          )}
        </View>
      </View>
      )}

      {/* Lead Match search field (opened by the header search icon). */}
      {tab === 'leadmatch' && lmSearchOpen && (
        <View style={s.lmSearchRow}>
          <Search size={16} color={HG.muted} />
          <TextInput
            value={lmQuery}
            onChangeText={setLmQuery}
            placeholder="Search property, area, city, BHK"
            placeholderTextColor={HG.muted}
            style={s.lmSearchInput}
            autoFocus
            returnKeyType="search"
          />
          {!!lmQuery && (
            <Pressable onPress={() => setLmQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Text style={{ color: HG.muted, fontSize: 18 }}>×</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Tab switcher row: Lead Match · My Group · CRM · Project ──
          Shown below the navbar pill, same translucent style. */}
      <View style={s.tabBtnRow}>
        {([
          { key: 'leadmatch', label: 'Lead Match', Icon: Zap },
          { key: 'mygroup',   label: 'My Group',   Icon: Users },
          { key: 'crm',       label: 'CRM',        Icon: BarChart3 },
          { key: 'marketplace', label: 'Project',  Icon: MapIcon },
        ] as const).map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (key === 'leadmatch') { setTab('leadmatch'); setLeadMatchReset((k) => k + 1); }
                else if (key === 'marketplace') { setFocusProjectId(null); setTab('marketplace'); }
                else setTab(key as OverviewTab);
              }}
              style={({ pressed }) => [s.tabBtn, active && s.tabBtnActive, pressed && { opacity: 0.75 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <Icon size={20} color={active ? HG.green : '#6B8F7B'} strokeWidth={active ? 2.5 : 1.9} />
              <Text style={[s.tabBtnLabel, active && s.tabBtnLabelActive]} numberOfLines={1}>{label}</Text>
              {key === 'crm' && crmHot > 0 && <View style={s.tabBtnDot} />}
            </Pressable>
          );
        })}
      </View>

      {/* ── My Post / Matching toggle — shown only on Lead Match, below tab row ── */}
      {tab === 'leadmatch' && (
        <LmPostMatchToggle
          lmBadge={lmBadge}
          onPost={() => lmActionsRef.current?.post()}
          onMatch={() => lmActionsRef.current?.matching()}
        />
      )}

      </View>

      {/* The Home (All Properties) tab was removed (user request). Map View is
          now its own bottom-nav tab, so it no longer needs a back bar. */}

      {/* Tab content wrapper: carries the tab-switch slide (see tabX). */}
      {/* Tabs whose controls sit at the very bottom (Ask AI composer, the map's
          bottom controls, an open group chat's composer) keep them above the
          floating pill. List tabs scroll behind it instead (see FLOAT_NAV_SPACE). */}
      <FloatTopContext.Provider value={usesFloatTop ? floatTop : 0}>
      <FloatBottomContext.Provider value={floatBottom}>
      <Animated.View style={{ flex: 1, opacity: tabFade, transform: [{ translateX: tabX }], paddingTop: usesFloatTop ? 0 : floatTop, paddingBottom: contentPad }}>
      {/* ── CRM tab ── */}
      {tab === 'crm' && (
        <View style={{ flex: 1 }}>
          <CrmLeadsScreen embedded searchVisible={crmSearch} addLeadSignal={crmAddSignal} learnSignal={crmLearnSignal} onModeChange={setCrmMode} />
        </View>
      )}

      {/* ── Project tab: full Google-map property view ── */}
      {tab === 'marketplace' && (
        <View style={{ flex: 1 }}>
          <PropertyMap isAdmin={user?.role === 'admin'} focusProjectId={focusProjectId} />
        </View>
      )}

      {/* ── Lead Match tab: the AI Lead Matching assistant chat, no sub-row. ── */}
      {/* Ask AI opens the existing HIT AI Assistant chat directly (its own
          input bar and controls), not the group landing that needed a second
          tap. A fresh key per open starts a new conversation. Match-card
          actions show the property on the existing Project map. */}
      {tab === 'ai' && (
        <View style={{ flex: 1 }}>
          <AiAssistant
            key={`ask-ai-${aiResetKey}`}
            // Jump straight into the flow with the intent picked in the
            // Buy / Sell / Rent popup.
            onReady={(api) => {
              const intent = pendingIntentRef.current;
              if (!intent) return;
              pendingIntentRef.current = null;
              setTimeout(() => api.startWithIntent(intent), 300);
            }}
            onViewProject={(projectId) => viewPropertyOnMap(projectId)}
            onJoinProjectGroup={(projectId) => viewPropertyOnMap(projectId)}
          />
        </View>
      )}


      {/* ── Lead Match tab (restored): the original AI Lead Matching hub —
          AI Lead Matching room (buyer requirements via Buy/Sell/Rent starters,
          auto property matching, match results) with My Post / Matching. Same
          component and backend APIs as before; nothing duplicated. ── */}
      {tab === 'leadmatch' && (
        <View style={{ flex: 1 }}>
          <LeadMatchingHub
            key="hub-leadmatch"
            embedded
            view="leadmatch"
            onChatActiveChange={setChatActive}
            resetSignal={leadMatchReset}
            feedQuery={lmQuery}
            onHostActions={handleLmActions}
            onMatchCount={handleLmMatchCount}
            onAskAI={openAskAI}
            onViewPropertyMap={viewPropertyOnMap}
          />
        </View>
      )}

      {/* ── My Group tab: the same hub opened on its Groups pane, with the
          Chats / My Post / Matching action pills in the sub-row. ── */}
      {tab === 'mygroup' && (
        <View style={{ flex: 1 }}>
          <LeadMatchingHub
            key="hub-mygroup"
            embedded
            view="mygroup"
            groupSearchOpen={groupSearchOpen}
            onGroupRoomOpenChange={setGroupRoomOpen}
            onChatActiveChange={setChatActive}
            onViewPropertyMap={viewPropertyOnMap}
          />
        </View>
      )}

      </Animated.View>
      </FloatBottomContext.Provider>
      </FloatTopContext.Provider>

      {/* ── Buy / Sell / Rent popup (opened by the Ask AI chat icon) ── */}
      <Modal visible={showIntentPicker} transparent animationType="fade" onRequestClose={() => setShowIntentPicker(false)}>
        <Pressable style={s.ipOverlay} onPress={() => setShowIntentPicker(false)}>
          <Pressable style={s.ipCard} onPress={() => {}}>
            <Text style={s.ipTitle}>What would you like to do?</Text>
            <Text style={s.ipSub}>HIT AI will guide you step by step.</Text>
            {([
              { k: 'buy', label: 'Buy', hint: 'Find a property to buy', Icon: Home },
              { k: 'sell', label: 'Sell', hint: 'List a property for sale', Icon: Tag },
              { k: 'rent', label: 'Rent', hint: 'Rent or let out a property', Icon: KeyRound },
            ] as const).map(({ k, label, hint, Icon }) => (
              <Pressable key={k} style={({ pressed }) => [s.ipRow, pressed && { opacity: 0.85 }]} onPress={() => startAi(k)}
                accessibilityRole="button" accessibilityLabel={label}>
                <View style={s.ipIcon}><Icon size={20} color={HG.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ipLabel}>{label}</Text>
                  <Text style={s.ipHint}>{hint}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowIntentPicker(false)} style={s.ipCancel} hitSlop={8}>
              <Text style={s.ipCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },

  // Navbar — overflow:hidden clips the HeaderPhoto that bleeds in from the right.
  // Floating header holder (absolute, above the content).
  floatHeaderWrap: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
  // The header itself: one rounded translucent pill, same look as the floating
  // footer (see-through white, faint green outline, no shadow, no inner boxes).
  // Floating pill: tighter gap between logo + name and the action icons.
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(31,77,58,0.10)',
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  menuBtn: { padding: 2 },
  // Orange rounded square holding the Home icon (was a tiny 'H' letterbox).
  // App logo: transparent, green house icon, tighter.
  logoBox: { width: 26, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  brandName: { fontSize: 15.5, fontWeight: '800', color: HG.green, letterSpacing: 0.1, flexShrink: 1 },
  // Lead Match header actions: boxless icon with a tiny label below.
  hdrAct: { alignItems: 'center', justifyContent: 'center', minWidth: 40, paddingHorizontal: 2, gap: 2 },
  hdrActText: { fontSize: 9, fontWeight: '700', color: HG.green },
  hdrActPressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  hdrUploadPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: HG.green, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  hdrUploadText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  hdrBadge: { position: 'absolute', top: -5, right: -9, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, backgroundColor: '#E0475B', alignItems: 'center', justifyContent: 'center' },
  hdrBadgeText: { fontSize: 8.5, fontWeight: '800', color: '#fff' },
  // Green "+" upload box in the bottom nav.
  navPlus: { width: 42, height: 34, borderRadius: 12, backgroundColor: HG.green, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  brandTagline: { fontSize: 9.5, fontWeight: '600', color: colors.brand, marginTop: 1 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Rounded translucent pill (matches the floating footer): see-through white,
  // faint green outline, no shadow, no per-button boxes.
  glassPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(31,77,58,0.10)' },
  // Floats under the header pill (inside floatHeaderWrap), so it is a frosted
  // pill too; a bit more opaque so typed text stays readable over the cards.
  lmSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 14, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(31,77,58,0.14)' },
  lmSearchInput: { flex: 1, fontSize: 14, color: HG.ink, paddingVertical: 0 },
  // Buy / Sell / Rent popup
  ipOverlay: { flex: 1, backgroundColor: 'rgba(10,20,15,0.45)', justifyContent: 'center', padding: 24 },
  ipCard: { backgroundColor: HG.bg, borderRadius: 22, padding: 20, gap: 10 },
  ipTitle: { fontSize: 18, fontWeight: '800', color: HG.ink },
  ipSub: { fontSize: 13, color: HG.muted, marginBottom: 6 },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HG.line },
  ipIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: HG.greenSoft, alignItems: 'center', justifyContent: 'center' },
  ipLabel: { fontSize: 16, fontWeight: '800', color: HG.ink },
  ipHint: { fontSize: 12, color: HG.muted, marginTop: 1 },
  ipCancel: { alignSelf: 'center', paddingVertical: 8, marginTop: 4 },
  ipCancelText: { fontSize: 14, fontWeight: '700', color: HG.green },
  searchBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: HG.greenSoft },
  uploadBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: HG.green, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  uploadText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Welcome card — warm brandDark orange surface (was near-black #1C1917) so it
  // reads as part of the warm palette against the cream background.
  welcomeCard: {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, backgroundColor: colors.brandDark,
    padding: 16, overflow: 'hidden', position: 'relative',
  },
  welcomeGlow: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -30 },
  welcomeInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { color: 'rgba(255,255,255,0.70)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  welcomeName: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 3 },
  welcomeStats: { flexDirection: 'row', gap: 18 },
  welcomeStat: { alignItems: 'center' },
  welcomeStatNum: { color: '#fff', fontSize: 19, fontWeight: '800' },
  welcomeStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 1 },

  // CRM "hot lead" badge, overlaid on that segment's icon.
  hotDotInline: { position: 'absolute', top: -3, right: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: colors.white },

  // ── Section switcher: outlined peach pills in a horizontal-scroll track ────
  // tabRow is the full-width band on the page background; tabTrack is the
  // rounded peach container; tabPill is its scroll content laying out the pills
  // in a row. Hardcoded warm hexes here match the reference exactly (lighter
  // than the theme tokens): track #EEF3EE on #DCE5DE, pills #FFFBF5 on #DCE5DE,
  // active fill #E7F0EA on #C9DCCF.
  tabRow: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#EAF8EE' },
  // Full-width track so the three pills can be spread evenly across the row (was
  // a horizontal-scroll track sized to its content, which left the pills bunched
  // at the left with empty space on the right).
  tabTrack: {
    alignSelf: 'stretch',
    backgroundColor: '#EEF3EE',
    borderWidth: 1,
    borderColor: '#DCE5DE',
    borderRadius: 24,
  },
  // space-evenly puts an equal gap between Lead Match · CRM · Project AND equal
  // margins at the two ends, so the three buttons are evenly distributed with the
  // same distance between each (user request).
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
  },
  // Fixed height on every segment keeps the pills aligned across the row.
  segment: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE5DE',
    backgroundColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Animated active fill. Absolute so it never affects layout.
  segmentFill: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: '#E7F0EA',
    borderWidth: 1,
    borderColor: '#C9DCCF',
    borderRadius: 18,
  },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  segmentIcon: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  // Label stays navy ink in both states; the active pill reads via its fill.
  segmentLabel: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  segmentLabelActive: { color: colors.ink, fontWeight: '700' },

  // ── Back bar on Map View / Ask AI ──
  subBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: HG.bg, borderBottomWidth: 1, borderBottomColor: HG.line },
  subBack: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subTitle: { fontSize: 17, fontWeight: '800', color: HG.ink },

  // ── Floating bottom navigation (rounded translucent pill) ──
  // Full-width solid white bar fixed at the bottom (a normal flex child).
  floatFootWrap: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
  bottomNavPill: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(31,77,58,0.10)', paddingHorizontal: 6, overflow: 'hidden' },
  floatNavWrap: { backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3E6E4' },
  bottomNav: {
    // Row of equal slots inside the white bar (the bar itself is floatNavWrap).
    flexDirection: 'row', alignItems: 'center', height: 56,
    backgroundColor: 'transparent', borderWidth: 0,
  },
  navItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 1 },
  navIconWrap: { position: 'relative', width: 46, height: 28, alignItems: 'center', justifyContent: 'center' },
  // Round "+" in the middle, like the reference footer.
  navPlusCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2', borderWidth: 1, borderColor: '#D9DEDB' },
  // Active-tab marker under the icon (transparent when inactive, so all icons
  // keep the same vertical position).
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  navLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  // Round green Ask AI (chat) button.
  aiRound: { width: 40, height: 40, borderRadius: 20, backgroundColor: HG.green, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  aiRoundActive: { borderWidth: 2, borderColor: HG.greenSoft },
  // ── My Post / Matching toggle below tab row (Lead Match only) ──
  lmPostMatchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  lmPMBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F3FBF5', borderWidth: 1, borderColor: 'rgba(31,77,58,0.18)',
  },
  lmPMBtnActive: { backgroundColor: '#1F4D3A', borderColor: '#1F4D3A' },
  lmPMTxt: { fontSize: 13, fontWeight: '700', color: '#1F4D3A' },
  lmPMTxtActive: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Tab switcher row (Lead Match · My Group · CRM · Project) ──
  // Sits inside the floating header wrap below the navbar pill.
  tabBtnRow: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(31,77,58,0.10)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#E7F0EA',
  },
  tabBtnLabel: {
    fontSize: 10, fontWeight: '600', color: '#6B8F7B',
  },
  tabBtnLabelActive: {
    color: '#1F4D3A', fontWeight: '800',
  },
  tabBtnDot: {
    position: 'absolute', top: 4, right: 10,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#fff',
  },
  // Half-height variant for My Post / Matching
  tabBtnHalf: { paddingVertical: 4, gap: 2 },
  // Upload circle in Lead Match header
  uploadCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1F4D3A',
    alignItems: 'center', justifyContent: 'center',
  },
  // ── Lead Match fixed footer ──
  lmFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E3E6E4',
    paddingTop: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  lmBsrRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lmBsrBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#F3FBF5', borderRadius: 20, borderWidth: 1, borderColor: '#CFE0D6',
    paddingVertical: 10,
  },
  lmBsrText: { fontSize: 11.5, fontWeight: '700', color: '#1F4D3A', flexShrink: 1 },
  lmMsgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  lmAttachBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3FBF5', borderWidth: 1, borderColor: '#CFE0D6',
  },
  lmMsgInput: {
    flex: 1, height: 42,
    backgroundColor: '#F3FBF5', borderRadius: 21, borderWidth: 1, borderColor: '#CFE0D6',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  lmMsgPlaceholder: { fontSize: 13.5, color: '#8A918C' },
  lmSendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1F4D3A',
    alignItems: 'center', justifyContent: 'center',
  },

});
