// AI Lead Matching Hub — 4-tab container
// Tabs: Groups (GroupChat), Chats (Chat), Assistant (AI slot-filling), Leads/Stats (admin)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import SlidePageModal from '../../src/components/SlidePageModal';
import { useFloatTop } from '../../src/lib/floatChrome';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, BarChart2, X, Building2, UserSearch, LucideIcon, ChevronLeft, ChevronRight, Target, Search, Upload, Home as HomeIcon, Tag as TagIcon, KeyRound } from '../../src/icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { leadMatchingApi } from '../../src/lib/api';
import { useAuth } from '../../src/lib/authContext';
import { useToast } from '../../src/components/Toast';
import { colors } from '../../src/theme';

// We import the full screens as components and render them inside tabs.
// This avoids duplicating navigation logic.
import GroupChatEmbedded from '../../src/components/GroupChatEmbedded';
import ChatEmbedded from '../../src/components/ChatEmbedded';
import MenuButton from '../../src/components/MenuButton';

type Tab = 'groups' | 'chats' | 'assistant' | 'leads';

// Imperative triggers exposed by the embedded AI Lead Matching group.
type GroupActions = {
  post: () => void;
  matching: () => void;
  resetToLanding: () => void;
};

const CONF_COLOR = (c: number) => c >= 0.8 ? colors.greenText : c >= 0.5 ? colors.amberText : colors.redText;
const CONF_BG    = (c: number) => c >= 0.8 ? colors.greenBg  : c >= 0.5 ? colors.amberBg  : colors.redBg;

// Note: an `AssistantTab` wrapper used to live here. It was dead — the hub renders
// GroupChatEmbedded (which hosts the assistant inline) or ChatEmbedded, never a
// standalone AiAssistant — so it has been removed along with its imports.

// ── Leads Tab (admin only) ─────────────────────────────────
function LeadsTab() {
  const toast = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [leadsTab, setLeadsTab] = useState<'list' | 'stats'>('list');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    // allSettled, not all: /stats is admin-only and 403s for builders, while
    // /leads succeeds for them. Promise.all rejected on the stats 403 and threw
    // away the leads that HAD loaded, so every builder saw "Failed to load" and
    // an empty list. Each result is now applied independently.
    let alive = true;
    Promise.allSettled([
      leadMatchingApi.getLeads({ limit: 30 }),
      leadMatchingApi.getStats(),
    ]).then(([leadsRes, statsRes]) => {
      if (!alive) return;
      if (leadsRes.status === 'fulfilled') {
        setLeads(leadsRes.value.leads || []);
      } else {
        toast.show('Failed to load leads', 'error');
      }
      // Stats are admin-only; a 403 here is expected for builders and must not
      // surface as an error.
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await leadMatchingApi.updateStatus(id, status);
      setLeads(prev => prev.map(l => l._id === id ? { ...l, status } : l));
      toast.show('Updated', 'success');
    } catch (e: any) {
      toast.show(e?.message || 'Failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} size="large" /></View>;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats is admin-only on the backend, so only offer the tab when we
          actually have stats — otherwise selecting it silently fell through to
          rendering the leads list, which looked broken. */}
      <View style={lt.tabs}>
        {(stats ? (['list', 'stats'] as const) : (['list'] as const)).map(t => (
          <Pressable key={t} onPress={() => setLeadsTab(t)} style={[lt.tabBtn, leadsTab === t && lt.tabBtnActive]}>
            <Text style={[lt.tabText, leadsTab === t && lt.tabTextActive]}>{t === 'list' ? 'Extracted Leads' : 'Stats'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {leadsTab === 'stats' && stats ? (
          <View style={{ gap: 12 }}>
            <View style={lt.statsRow}>
              {[['Total', stats.total], ['Matched', stats.withMatches], ['Rate', stats.matchRate]].map(([k, v]) => (
                <View key={k as string} style={lt.statCard}>
                  <Text style={lt.statNum}>{v}</Text>
                  <Text style={lt.statLbl}>{k}</Text>
                </View>
              ))}
            </View>
            {stats.byStatus && Object.entries(stats.byStatus).map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Text style={{ fontSize: 12, color: colors.muted2, textTransform: 'capitalize' }}>{k}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{v as number}</Text>
              </View>
            ))}
          </View>
        ) : (
          leads.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>No extracted leads yet</Text>
            </View>
          ) : leads.map(l => {
            const conf = l.extractionConfidence || 0;
            return (
              <View key={l._id} style={lt.card}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <View style={[{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }, { backgroundColor: CONF_BG(conf) }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: CONF_COLOR(conf) }}>{Math.round(conf * 100)}% conf</Text>
                  </View>
                  <View style={{ backgroundColor: colors.indigoBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.indigoText }}>{l.intent || ''}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.muted, fontStyle: 'italic' }}>{l.source}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.muted2, marginBottom: 6 }} numberOfLines={2}>{l.originalText}</Text>
                {l.params && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                    {l.params.bhkType && <Chip label={l.params.bhkType} />}
                    {l.params.city && <Chip label={l.params.city} />}
                    {l.params.budget && <Chip label={`₹${l.params.budget}L`} />}
                  </View>
                )}
                {l.status === 'auto_detected' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => handleStatus(l._id, 'confirmed')} disabled={updating === l._id}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.greenBorder, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.greenText }}>Confirm</Text>
                    </Pressable>
                    <Pressable onPress={() => handleStatus(l._id, 'rejected')} disabled={updating === l._id}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.redBg, borderWidth: 1, borderColor: colors.redBorder, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.redText }}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const lt = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.brand },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted2 },
  tabTextActive: { color: colors.brand },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 19, fontWeight: 'bold', color: colors.ink },
  statLbl: { fontSize: 10, color: colors.muted, marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
});

function Chip({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: colors.slateBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: colors.slateBorder }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.slateText }}>{label}</Text>
    </View>
  );
}

// ── Sub-row pane pill (Groups / Chats) ───────────────────────
// Renderer for the two PANE SWITCHERS only. The two AI actions share the same row
// and are drawn by AiActionPill below.
//
// HISTORY, so the shape is not flipped back and forth again. These two were
// deliberately underline TABS and the actions were pills, because the two kinds
// do different things:
//   • pane ('Groups' / 'Chats') — picks which content pane is shown; mutually
//     exclusive, and one of them is always selected.
//   • action ('My Post' / 'Matching') — one-shot triggers that open a modal and
//     have no selected state at all, so they must never hold a persistent lit
//     state: that would claim a view is active when the pane never changed.
// The shape difference was how that split read at rest. The user asked for all
// four to read as ONE pill set, so the shapes now match and the split moved into
// the FILL: a solid brand pill is the selected pane, a tinted/outlined pill is a
// one-shot action. That, plus accessibilityRole (tab vs button), is what still
// encodes the distinction — the 2px brand underline was previously the only
// selected-state signal, so the pills had to take that job over, which is why
// selected here is a full brand fill rather than a tint.
function SubTab({ label, Icon, active, onPress }: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [hub.panePill, active && hub.panePillActive, pressed && hub.subTabPressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {/* Icon-only pill (reference re-skin). The visible Text label was dropped
          from the screen — these pills read as one compact icon set now — but the
          label stays as the accessibilityLabel above so screen readers still
          announce "Groups" / "Chats". Previously each pill rendered a 13px icon +
          an ellipsizing Text; the label was the only thing that forced the
          flexShrink/numberOfLines gymnastics, and with it gone the icon alone
          sizes the pill. 17px matches AiActionPill's icon. */}
      {/* White when selected: the selected pill is a solid brand fill
          (panePillActive), and the icon used to stay brand-coloured on it, so the
          selected pane's icon vanished into an empty orange circle. */}
      <Icon size={17} color={active ? colors.white : HG_GREEN} style={hub.subTabIcon} />
    </Pressable>
  );
}

// Lead Match top section palette (action cards + promo banner).
const LM = {
  forest: '#064E3B', deep: '#0B5D43', mint: '#E8F5EC', sage: '#C8E6D0',
  cream: '#F7FBF5', text: '#142D24', aqua: '#DDF3EF',
};

// ── Green icon button (Chats / My Post / Matching in the Groups filter row) ──
const HG_GREEN = '#1F4D3A';
const HG_GREEN_SOFT = '#E7F0EA';
function GreenIconBtn({ label, Icon, active, count, onPress }: {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  count?: number | null;
  onPress: () => void;
}) {
  return (
    // Same equal-width slot as the Groups filters (flex: 1): circle icon with a
    // small label underneath.
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [hub.greenSlot, pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] }]}
      accessibilityRole="button"
      accessibilityLabel={typeof count === 'number' && count > 0 ? `${label}, ${count}` : label}
    >
      <View style={hub.greenBtn}>
        <Icon size={20} color={HG_GREEN} strokeWidth={active ? 2.8 : 2} />
        {typeof count === 'number' && count > 0 && (
          <View style={[hub.aiPillBadge, hub.aiPillBadgeCorner, { backgroundColor: HG_GREEN, right: -4 }]}>
            <Text style={hub.aiPillBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={hub.greenSlotText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ── Sub-row AI action pill (My Post / Matching) ───────────────
// The exact pill look these two had before they were merged into this row, when
// they lived in GroupChatEmbedded's own action bar: 16px radius, 1px border,
// 11px/800 label, 13px icon, colours supplied per pill (My Post = greenText on
// greenBg/greenBorder, Matching = brand on brandTint with a 33%-alpha brand
// border). A previous pass restyled them as plain underline tabs; the user wants
// the pills, so the values were recovered from the pre-merge code rather than
// re-picked by eye. SubTab now shares this geometry — see its comment.
//
// accessibilityRole is "button", not "tab": tapping one opens a modal instead of
// changing which pane the row has selected. That is also why the tablist role
// stays on the pane wrapper and does not cover these two — a row that mixes
// navigation with actions must not announce every child as a tab.
function AiActionPill({ label, Icon, fg, bg, border, count, onPress }: {
  label: string;
  Icon: LucideIcon;
  fg: string;
  bg: string;
  border: string;
  // How many results the action would show, when that is known. Only Matching
  // passes it.
  count?: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // Pressed opacity is the one addition to the pre-merge pills: an action with
      // no selected state has nothing else to acknowledge a tap with, and the
      // modal it opens can take a moment to appear. Rest appearance is unchanged.
      style={({ pressed }) => [hub.aiPill, { backgroundColor: bg, borderColor: border }, pressed && hub.subTabPressed]}
      accessibilityRole="button"
      accessibilityLabel={typeof count === 'number' && count > 0 ? `${label}, ${count}` : label}
    >
      {/* Icon-only pill (reference re-skin), matching SubTab. The visible Text
          label was dropped — the accessibilityLabel above still carries it (and
          the count, so screen readers announce "Matching, 3"). */}
      <Icon size={17} color={fg} />
      {/* `> 0` is deliberate. A `0` badge on a pill reads as a bug, and a null
          count means "not loaded / request failed", which must not render as
          zero either — the sheet explains an empty or failed result honestly.
          With the label gone the badge no longer sits inline after the text; it
          is absolutely positioned on the pill's top-right corner instead. */}
      {typeof count === 'number' && count > 0 && (
        <View style={[hub.aiPillBadge, hub.aiPillBadgeCorner]}>
          <Text style={hub.aiPillBadgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Main Hub ─────────────────────────────────────────────────
export default function LeadMatchingHub({
  embedded = false,
  onChatActiveChange,
  resetSignal = 0,
  view = 'leadmatch',
  onViewPropertyMap,
  feedQuery = '',
  onHostActions,
  onMatchCount,
  onAskAI,
  groupSearchOpen,
  onGroupRoomOpenChange,
}: {
  // Reports whether a group chat room is open (host keeps its composer clear
  // of the floating bottom nav).
  onGroupRoomOpenChange?: (open: boolean) => void;
  // My Group: the host header's search icon controls the Groups search field.
  groupSearchOpen?: boolean;
  // Lead Match header search text (filters the property cards).
  feedQuery?: string;
  // Publishes stable My Post / Matching triggers so the host header can show
  // them as icons next to the HomeInTown logo.
  onHostActions?: (a: { post: () => void; matching: () => void }) => void;
  // Publishes the Matching count for the header badge.
  onMatchCount?: (n: number | null) => void;
  // "Chat Now" in the Lead Match banner opens the host's Ask AI flow.
  // With an intent the chat opens straight away; without one the host shows its popup.
  onAskAI?: (intent?: 'buy' | 'sell' | 'rent') => void;
  embedded?: boolean;
  onChatActiveChange?: (active: boolean) => void;
  // Incremented by the parent each time the "AI Leads" section button is tapped.
  // Every change returns this hub to its default landing view.
  resetSignal?: number;
  // Bubbled up from GroupChatEmbedded's "View Property" button to the Overview,
  // which switches to the Project map tab.
  onViewPropertyMap?: (projectId: string) => void;
  // Which host tab is rendering this hub:
  //   'leadmatch' → the AI Lead Matching assistant chat, NO sub-row at all.
  //   'mygroup'   → the Groups pane, with a sub-row of Chats / My Post / Matching.
  // The two are separate SectionTabs in the Overview switcher now, so the pane
  // switching that used to live inside this hub's sub-row is driven by `view`.
  view?: 'leadmatch' | 'mygroup';
} = {}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // 'assistant' = the AI Lead Matching group chat. 'groups' / 'chats' switch the
  // content pane. The default pane depends on which host tab mounted this hub:
  // Lead Match opens the assistant chat; My Group opens the Groups list.
  const [tab, setTab] = useState<'chats' | 'assistant' | 'groups'>(
    view === 'mygroup' ? 'groups' : 'assistant',
  );
  const [showLeads, setShowLeads] = useState(false);
  // Post / Matching triggers exposed by the embedded assistant group.
  const groupActionsRef = useRef<GroupActions | null>(null);
  // An action requested from the Groups/Chats pane while the assistant pane was
  // not yet mounted. Held here and run once the assistant publishes its triggers
  // (handleActionsReady), so My Post / Matching work from any pane.
  const pendingActionRef = useRef<'post' | 'matching' | null>(null);
  // Search field of the Groups list. Hidden until the Groups-pane search pill is
  // tapped; passed down to GroupChatEmbedded as `showSearch`.
  const [showGroupSearch, setShowGroupSearch] = useState(false);
  // Stable identity so the child's onActionsReady effect doesn't re-run each render.
  const handleActionsReady = useCallback((a: GroupActions) => {
    groupActionsRef.current = a;
    // My Post / Matching tapped from the Groups or Chats pane switched to the
    // assistant pane first; the queued action runs once the assistant has
    // published its triggers (this callback). The small delay lets the assistant
    // finish its initial landing render before the action drives it.
    const pending = pendingActionRef.current;
    if (pending) {
      pendingActionRef.current = null;
      setTimeout(() => { if (pending === 'post') a.post(); else a.matching(); }, 450);
    }
  }, []);
  // How many projects this user's requirements currently match, reported by the
  // assistant pane so the Matching pill can carry a number. `null` = not known
  // (never loaded, or the request failed), which is NOT the same as 0 and must
  // not render as a badge. Stable callback for the same reason as above: the
  // child publishes it from an effect, so a fresh identity each render would
  // re-fire that effect on every keystroke in the composer.
  const [matchCount, setMatchCount] = useState<number | null>(null);
  // Triggers published by the GROUPS pane, so Matching can open its popup there.
  const groupsActionsRef = useRef<GroupActions | null>(null);
  const handleGroupsActionsReady = useCallback((a: GroupActions) => { groupsActionsRef.current = a; }, []);
  const handleMatchCountChange = useCallback((n: number | null) => setMatchCount(n), []);
  // Whether AI Assist applies to the room the assistant pane currently has open.
  // Reported by the pane itself, because only it knows which room that is — see
  // aiActionsVisible below for what this replaced and why. Stable callback for
  // the same reason as handleMatchCountChange: the child publishes it from an
  // effect, so a fresh identity each render would re-fire that effect.
  const [aiAvailable, setAiAvailable] = useState(false);
  const handleAiAvailableChange = useCallback((available: boolean) => setAiAvailable(available), []);

  // Tapping the "AI Leads" section button returns to the default landing page —
  // the same view the app opens on — instead of dropping the user back into a
  // half-finished conversation. Skips the initial mount (resetSignal 0).
  React.useEffect(() => {
    if (!resetSignal) return;
    setTab('assistant');
    setShowLeads(false);
    groupActionsRef.current?.resetToLanding();
  }, [resetSignal]);
  // When a group room is opened, hide the header + top tab bar for a
  // full-screen chat experience (matches the website behavior).
  const floatTop = useFloatTop();
  const [groupOpen, setGroupOpen] = useState(false);
  React.useEffect(() => { onGroupRoomOpenChange?.(groupOpen); }, [groupOpen, onGroupRoomOpenChange]);
  const isAdmin = ['admin', 'builder'].includes(user?.role ?? '');

  // Report "chat active" to the parent (Overview) so it can hide the welcome
  // banner. The AI Lead Matching section IS the group chat, so this is always
  // true — `tab` was in the deps but changed nothing, so it only re-fired.
  React.useEffect(() => {
    onChatActiveChange?.(true);
  }, [onChatActiveChange]);

  // Sub-row under the AI Leads section: Groups · Chats on the left, My Post ·
  // Matching pushed to the right-hand end of the same line.
  //
  // Only the two pane switchers used to live here; My Post / Matching sat in the
  // chat's own action row inside GroupChatEmbedded, one row lower, on the
  // reasoning that a bar mixing navigation with actions was confusing. The user
  // asked for all four on one line, so the actions moved up here. The old
  // reasoning is recorded so the second row is not silently reintroduced. The
  // navigation / action distinction used to be carried by the two SHAPES
  // (underline tab vs pill); the user then asked for all four to read as one pill
  // set, so it is now carried by the FILL (solid brand = selected pane, tinted =
  // one-shot action), by the gap between the two groups, and by the
  // tab-vs-button accessibility roles.
  //
  // Nothing about what the actions DO changed: they call the same post() /
  // matching() triggers the assistant pane already published through
  // onActionsReady → groupActionsRef, so no new props or state were needed.
  // Both pane switchers live here: Groups and Chats. A tweak had dropped the
  // 'Chats' pill, but that left this row with a single pill (reading as a stray
  // icon) and no way to reach the Chats pane, so the user asked for all four
  // pills back on this screen — Chats is restored here, My Post / Matching and
  // the Groups-pane Search pill were never removed.
  // My Group's sub-row shows only the Chats pane switcher now — "Groups" became
  // its own Overview tab, so a Groups pill here would be redundant. The default
  // pane for this view is 'groups'; tapping Chats swaps to the Chats pane and
  // tapping it again (or any My Post / Matching action) is handled below.
  const SUB = [
    { key: 'chats',  label: 'Chats',  icon: MessageSquare, active: tab === 'chats',  onPress: () => setTab(tab === 'chats' ? 'groups' : 'chats') },
  ];

  // My Post / Matching from any pane: if the assistant pane is already open and
  // its triggers are published, fire immediately; otherwise queue the action and
  // switch to the assistant pane, where handleActionsReady runs it once ready.
  // Keeps the two actions reachable from Groups / Chats without loosening the
  // aiActionsVisible gate below.
  const runAssistantAction = (kind: 'post' | 'matching') => {
    if (tab === 'assistant' && groupActionsRef.current) {
      if (kind === 'post') groupActionsRef.current.post(); else groupActionsRef.current.matching();
      return;
    }
    pendingActionRef.current = kind;
    setTab('assistant');
  };
  // Stable wrappers for the host header (runAssistantAction closes over `tab`).
  const runActionRef = useRef(runAssistantAction);
  runActionRef.current = runAssistantAction;
  React.useEffect(() => {
    if (view !== 'leadmatch' || !onHostActions) return;
    onHostActions({
      post: () => runActionRef.current('post'),
      matching: () => runActionRef.current('matching'),
    });
  }, [view, onHostActions]);
  React.useEffect(() => {
    if (view === 'leadmatch') onMatchCount?.(matchCount);
  }, [view, matchCount, onMatchCount]);

  // My Post / Matching are actions ON the AI Assist room, so they are shown only
  // while that room is the one open in the assistant pane.
  //
  // This used to read `tab === 'assistant' && groupOpen`, which reproduced the
  // child's old gate (`headerless && aiAllowed`) exactly — back when `aiAllowed`
  // collapsed to `!!activeRoom` because it was decided by the pane prop. It no
  // longer does: the child now decides by ROOM IDENTITY, and the assistant pane
  // can hold a property room (Join Group on a match row opens one there). In that
  // room `groupOpen` is still true, so the old rule kept both pills on screen
  // where My Post would enter AI mode only for the child's safety net to drop it
  // again — a button that visibly does nothing. `aiAvailable` is the child's own
  // answer, so the two can never disagree.
  //
  // When false the action group is not rendered at all; because the pane pills are
  // content-width and left-aligned (not flex cells) they simply stay where they
  // are instead of re-centring or stretching.
  //
  // On the Groups and Chats panes the two pills are shown too. They used to be
  // hidden there, so the row looked broken (the user saw only Groups / Chats /
  // Search). Tapping one from those panes is already safe: runAssistantAction
  // queues the action and switches to the assistant pane, which runs it once its
  // triggers are ready. The room-identity gate above still applies inside the
  // assistant pane, so a property room there keeps the pills hidden.
  const aiActionsVisible = tab === 'groups' || tab === 'chats' || (tab === 'assistant' && groupOpen && aiAvailable);

  // The sub-row (Chats / My Post / Matching pills) belongs to the My Group view
  // only. The Lead Match view is just the assistant chat with no pills at all.
  // On the Groups pane these icons now live INSIDE the group-filter row (beside
  // Property Groups), so the separate sub-row is shown only on the Chats pane,
  // where it is the way back to Groups.
  // The Chats / My Post / Matching icon sub-row is no longer shown anywhere in
  // My Group: on Groups they sit in the filter row, Chats opens the conversation
  // directly (its own back returns to Groups), and on the My Post / Matching
  // (assistant) pane a plain green "← Groups" back bar replaces them.
  // Lead Match (restored): its sub-row carries the My Post / Matching actions of
  // the AI Lead Matching room, as in the original app. My Group still shows none.
  // My Post / Matching removed from Lead Match too (user request) — no sub-row.
  const showSubRow = false;
  const showAssistantBack = view === 'mygroup' && tab === 'assistant';

  // Chats · My Post · Matching as green icon buttons, handed to the Groups
  // pane's filter row. Same handlers as the sub-row pills.
  const groupRowExtra = (
    <>
      <GreenIconBtn label="My Post" Icon={Building2} onPress={() => runAssistantAction('post')} />
      {/* Opens the Your Matches popup over the Groups list itself (no switch
          to the AI-chat pane, whose property cards used to show behind it). */}
      <GreenIconBtn
        label="Matching"
        Icon={Target}
        count={matchCount}
        onPress={() => (groupsActionsRef.current ? groupsActionsRef.current.matching() : runAssistantAction('matching'))}
      />
    </>
  );

  // Lead Match banner — handed to the AI room's feed as its LIST HEADER, so it
  // scrolls away with the property cards (not sticky). My Post / Matching sit in
  // their own row below the tagline: icon above a small label. Same handlers as
  // before (runAssistantAction → the AI room's post() / matching()).
  // Lead Match top: (1) four compact mint action cards — Search · Upload ·
  // My Post · Matching — same handlers as before; (2) the promo banner with a
  // mint→cream gradient, house photo on the right fading into the gradient,
  // dark-green headline + subline (no "Explore Now"). Both are the feed's list
  // header, so they scroll away with the property cards.
  // My Post / Matching / Search now live in the host header (crm.tsx); this is
  // just the compact promo box with a "Chat Now" button that opens Ask AI.
  // Buy / Sell / Rent buttons that replace the tagline box.
  const intentItems = [
    { v: 'buy' as const, label: 'Buy Property', Icon: HomeIcon },
    { v: 'sell' as const, label: 'Sell Property', Icon: TagIcon },
    { v: 'rent' as const, label: 'Rent Property', Icon: KeyRound },
  ];
  const leadMatchBanner = view === 'leadmatch' ? (
    // Segmented pill: the picked option is a filled green pill with white text and
    // a small bar under it; the others are plain with thin dividers between them.
    <View style={hub.intentBox}>
      {intentItems.map(({ v, label, Icon }, i) => (
        <React.Fragment key={v}>
          {i > 0 && <View style={hub.intentDivider} />}
          <Pressable
            onPress={() => onAskAI?.(v)}
            style={({ pressed }) => [hub.intentItem, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon size={18} color={HG_GREEN} strokeWidth={2.2} />
            <Text style={hub.intentText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  ) : null;

  // Keep the tab bar visible on the AI Lead Matching section (it IS the primary
  // section). Only hide chrome when a room is opened from the separate Groups tab.
  const chromeHidden = tab === 'groups' && groupOpen;

  return (
    <View style={[hub.root, { paddingTop: (chromeHidden || embedded) ? 0 : insets.top }]}>
      {/* Header + tab bar hidden while a group is open */}
      {!chromeHidden && (
        <>
          {/* Own header hidden when embedded (Overview provides the navbar) */}
          {!embedded && (
            <View style={hub.header}>
              <MenuButton />
              <View style={{ flex: 1 }} />
              {isAdmin && (
                <Pressable onPress={() => setShowLeads(true)} style={hub.leadsBtn}>
                  <BarChart2 size={15} color={colors.brand} />
                  <Text style={hub.leadsBtnText}>Leads</Text>
                </Pressable>
              )}
            </View>
          )}

          {showAssistantBack && (
            <View style={hub.backBar}>
              <Pressable onPress={() => setTab('groups')} style={hub.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to groups">
                <ChevronLeft size={22} color={HG_GREEN} />
                <Text style={hub.backText}>Groups</Text>
              </Pressable>
            </View>
          )}


          {/* Sub-row: Chats | My Post · Matching — shown only in the My Group
              view. The Lead Match view has no sub-row (just the assistant chat).
              The Groups pane switcher moved up to the Overview switcher as its own
              "My Group" tab, so only Chats remains here as a pane switcher. */}
          {showSubRow && (
          <View style={hub.subBar}>
            {/* tablist covers ONLY the pane switchers. The pills next to them are
                buttons, not tabs, so they sit outside this wrapper. */}
            <View style={hub.subPanes} accessibilityRole="tablist">
              {(view === 'leadmatch' ? [] : SUB).map(item => (
                <SubTab
                  key={item.key}
                  label={item.label}
                  Icon={item.icon}
                  active={item.active}
                  onPress={item.onPress}
                />
              ))}
            </View>
            {/* My Post / Matching stay gated on the room-identity rule — they are
                actions ON the AI Assist room and must not light up on a property
                room (see aiActionsVisible). The Groups-pane Search pill below is
                NOT part of that gate: it toggles the Groups list's own search
                field, which has nothing to do with the assistant room, so it sits
                outside and shows whenever the Groups pane is active. */}
            {aiActionsVisible && (
              <View style={hub.aiActions}>
                <AiActionPill
                  label="My Post"
                  Icon={Building2}
                  // Warm re-skin: navy icon on a cream fill with a peach outline,
                  // replacing the old green "success" scheme — these are actions,
                  // not status, so the meaning-green no longer applied.
                  fg={HG_GREEN}
                  bg={HG_GREEN_SOFT}
                  border={HG_GREEN_SOFT}
                  onPress={() => runAssistantAction('post')}
                />
                <AiActionPill
                  label="Matching"
                  // UserSearch (reference) reads as "match me to people/projects"
                  // better than the plain magnifier the pre-reskin pill used.
                  Icon={Target}
                  fg={HG_GREEN}
                  bg={HG_GREEN_SOFT}
                  border={HG_GREEN_SOFT}
                  // Only this pill gets a count — My Post has no equivalent
                  // prefetched total.
                  count={matchCount}
                  onPress={() => runAssistantAction('matching')}
                />
              </View>
            )}
          </View>
          )}
        </>
      )}

      {/* Content: the AI Lead Matching group chat is the base view (headerless —
          this hub's sub-row replaces its header). 'chats' / 'groups' swap panes. */}
      <View style={{ flex: 1 }}>
        {tab === 'chats' ? (
          // My Group's Chats icon opens the conversation directly; its back
          // returns to the Groups list.
          // Starts below the host's floating header pill.
          <View style={{ flex: 1, paddingTop: Math.max(0, floatTop - 8) }}>
            {/* Sessions list first; tapping a chat opens it, back returns to the
                list, and Back on the list returns to Groups. */}
            {view === 'mygroup'
              ? <ChatEmbedded onExit={() => setTab('groups')} />
              : <ChatEmbedded />}
          </View>
        ) : tab === 'groups' ? (
          // Distinct `key` per pane is REQUIRED, not cosmetic. Both branches
          // render GroupChatEmbedded at the same position in the same parent, so
          // React reconciled them as one component and merely swapped props —
          // meaning all internal state (aiMode, activeRoom, messages, drafts)
          // survived the tab switch. That let an AI Assist conversation started in
          // the AI Leads pane stay live after switching to Groups and opening a
          // property group, so the assistant's greeting and Buy/Sell/Rent intent
          // chips rendered inside an ordinary group. Separate keys force a clean
          // unmount/mount of each pane.
          <GroupChatEmbedded
            key="groups-pane"
            onRoomOpenChange={setGroupOpen}
            topInset={embedded ? 0 : insets.top}
            onViewPropertyMap={onViewPropertyMap}
            // Driven by the Groups-pane search pill above; the field only appears
            // when the user turns it on.
            showSearch={groupSearchOpen ?? showGroupSearch}
            filterRowExtra={view === 'mygroup' ? groupRowExtra : undefined}
            onChatsPress={view === 'mygroup' ? () => setTab('chats') : undefined}
            onActionsReady={handleGroupsActionsReady}
            onMatchCountChange={handleMatchCountChange}
          />
        ) : (
          <GroupChatEmbedded
            key="assistant-pane"
            // Lead Match is a property feed only: no Buy/Sell/Rent starters and
            // no chat box (Ask AI in the bottom bar covers those).
            readOnly={view === 'leadmatch'}
            showComposer={view === 'leadmatch'}
            feedQuery={view === 'leadmatch' ? feedQuery : ''}
            feedHeader={leadMatchBanner}
            onRoomOpenChange={setGroupOpen}
            topInset={0}
            autoOpenUniversal
            hideThreadBack
            headerless
            onViewPropertyMap={onViewPropertyMap}
            onActionsReady={handleActionsReady}
            // Chat button on inventory cards → opens the AI chat with 'buy' intent
            // Chat on a card → Buy / Sell / Rent options; the pick opens the chat page.
            onInventoryCardChat={onAskAI ? () => onAskAI() : undefined}
            // Only the assistant pane reports a match count: it is the only pane
            // that renders the Matching pill, so the groups pane must not pay for
            // the prefetch request.
            onMatchCountChange={handleMatchCountChange}
            // Only this pane renders the My Post / Matching pills, so only this
            // pane needs to know whether AI Assist applies to the open room.
            onAiAvailableChange={handleAiAvailableChange}
          />
        )}
      </View>

      {/* Leads overlay (opened from the top button)

          WHY `statusBarTranslucent` IS ON THIS Modal. Without it the top inset
          landed TWICE, leaving a blank colors.cream band exactly one
          status-bar/cutout height tall above the "Extracted Leads" header:
          React Native wraps a non-translucent Android Modal's content in a
          FrameLayout with fitsSystemWindows = true, so the dialog window already
          reserved the status bar, while expo-status-bar's <StatusBar> in
          app/_layout.tsx defaults to translucent = true — so the ACTIVITY window
          draws under the bar and useSafeAreaInsets() measures a non-zero top,
          which the inner View then added on top of the reservation.

          This is the same defect and the same one-prop fix as the Project-map
          Join Group modal; the full root-cause write-up lives in exactly one
          place, the "WHY statusBarTranslucent IS ON THIS Modal" block in
          src/components/PropertyMap.tsx, so the two explanations cannot drift.
          The prop is Android-only and the inner `paddingTop: insets.top` is
          deliberately retained — it is what keeps iOS correct, where a
          full-screen modal genuinely does not inset for the notch. No pixel
          constant is involved, so a device with a different bar height is still
          right.

          Sweep result, recorded here so the next reader does not have to redo
          it: across all of src/ and app/ these are the ONLY TWO <Modal> sites
          that ever combined a non-transparent modal with a top inset applied to
          its own content — this one and PropertyMap.tsx:609/610. Both now carry
          the prop. Every other `insets.top` in the app is a screen root (or
          Sidebar.tsx's drawer, which is an absolute-fill View, not a modal), and
          the many `transparent` bottom sheets never add a top inset at all. So
          there is no third site waiting to be found. */}
      <SlidePageModal visible={showLeads} onRequestClose={() => setShowLeads(false)}>
        <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
          <View style={hub.header}>
            <Text style={hub.headerTitle}>Extracted Leads</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setShowLeads(false)} style={hub.closeBtn}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
          <LeadsTab />
        </View>
      </SlidePageModal>
    </View>
  );
}

const hub = StyleSheet.create({
  // Transparent: the dashboard's mint background shows through.
  root: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'transparent' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.ink },
  // Sub-row: the Groups · Chats tabs, then the My Post · Matching pills at the
  // far right of the same line.
  // paddingVertical moved here from the pane tabs. They used to own the row's
  // vertical rhythm with paddingVertical: 11 (needed to push the 2px underline to
  // the bottom edge); now that they are pills of the same height as the actions,
  // the row supplies the breathing space so both groups sit on one baseline.
  subBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 7, paddingHorizontal: 12 },
  // The pane pills are content-width, not `flex: 1` cells. They used to split the
  // row evenly (2 cells, then 4 once the actions were merged in), but even cells
  // left no gap between Chats and the My Post pill. Content width keeps the pair
  // at the left edge whether or not the actions are showing. flexShrink lets the
  // group give way before anything clips. gap 6 matches the action group, so all
  // four pills are evenly spaced.
  subPanes: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  // Same geometry as aiPill below — radius 16, 1px border, 9/6 padding, gap 4 —
  // because the user wants all four to read as one control set. The difference is
  // the fill: solid brand = this pane is selected, outline = not selected.
  panePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexShrink: 1 },
  panePillActive: { backgroundColor: HG_GREEN, borderColor: HG_GREEN },
  // Touch feedback. The actions need it most — they have no selected state to
  // change — and the pane pills share it for parity.
  subTabPressed: { opacity: 0.55 },
  // Lead Match banner (medium photo box with tagline + text actions).
  // Half-height solid green banner; actions pinned to the top-right corner.
  // ── Lead Match action row (Search · Upload · My Post · Matching) ──
  actRow: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 12 },
  actCard: {
    flex: 1, aspectRatio: 1, maxHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 16, backgroundColor: LM.mint, borderWidth: 1, borderColor: LM.sage,
    shadowColor: LM.forest, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  actCardActive: { backgroundColor: LM.sage, borderColor: LM.deep },
  actText: { fontSize: 11.5, fontWeight: '700', color: LM.text },
  actBadge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: LM.deep, alignItems: 'center', justifyContent: 'center' },
  actBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  // Buy / Sell / Rent segmented pill (reference design, green).
  // Tight: no gap above (the feed already starts under the header) and none below
  // (the feed's own row gap separates it from the first card).
  intentBox: { flexDirection: 'row', alignItems: 'center', marginTop: 0, marginBottom: 0, paddingVertical: 3, paddingHorizontal: 4, borderRadius: 999, backgroundColor: '#F7FBF8', borderWidth: 1.5, borderColor: '#CFE0D6', shadowColor: HG_GREEN, shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  intentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 999 },
  intentText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: '#17233A' },
  intentDivider: { width: 1, height: 24, backgroundColor: '#D8E6DD' },
  // Half-height LIGHT green banner; actions pinned to the top-right corner.
  banner: { height: 84, marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: HG_GREEN_SOFT, borderWidth: 1, borderColor: '#C9DCCF' },
  bannerTitle: { flex: 1, alignSelf: 'center', fontSize: 15, fontWeight: '700', fontStyle: 'italic', color: HG_GREEN, lineHeight: 20 },
  bannerActions: { flexDirection: 'row', gap: 14 },
  // Small icon (no box) above a small label.
  bannerOpt: { alignItems: 'center', gap: 2 },
  bannerOptText: { fontSize: 9.5, fontWeight: '700', color: HG_GREEN },
  bannerBadge: { position: 'absolute', top: -6, right: -9, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, backgroundColor: '#E0475B', alignItems: 'center', justifyContent: 'center' },
  bannerBadgeText: { fontSize: 8.5, fontWeight: '800', color: '#fff' },
  backBar: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#EAF8EE', borderBottomWidth: 1, borderBottomColor: '#ECE5D8' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '700', color: HG_GREEN },
  // Green circular icon button used in the Groups filter row.
  // Transparent (no fill), same footprint as the Groups filter icons.
  greenBtn: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  greenSlot: { flex: 1, alignItems: 'center', gap: 4 },
  greenSlotText: { fontSize: 9.5, fontWeight: '700', color: HG_GREEN, textAlign: 'center' },
  subTabIcon: { flexShrink: 0 },
  // flexShrink: 1 is what makes numberOfLines={1} on the label effective. RN
  // defaults flexShrink to 0, so without it a label is measured at its intrinsic
  // width and spills out of its cell instead of ellipsizing — reachable at a
  // system font scale above 1.0 on a ~320dp screen, where all four pills together
  // exceed the row width.
  panePillText: { fontSize: 11, fontWeight: '800', color: colors.muted2, flexShrink: 1 },
  panePillTextActive: { color: '#fff' },
  // All pill groups are left-aligned now (user request): the action group sits
  // right after the pane pills with a marginLeft:6 gap instead of being pushed to
  // the far right with marginLeft:'auto'. gap 6 between pills matches the pane
  // group so the whole row reads as one evenly-spaced, left-aligned control set.
  aiActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6, flexShrink: 1 },
  // Recovered verbatim from GroupChatEmbedded's `headerAiBtn` / `headerAiBtnText`
  // (the pills' home before the merge) so the look is identical to the screenshot
  // the user pointed at, rather than re-derived. Colours are passed per pill.
  // radius 16 against a ~27px tall pill is a full round, as before.
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 16, borderWidth: 1, flexShrink: 1 },
  aiPillText: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
  // Count badge on the Matching pill. Brand fill with white text rather than the
  // pill's own tinted scheme, so the number reads as a separate token and not as
  // part of the label. flexShrink: 0 — the number must never be the thing that
  // ellipsizes.
  aiPillBadge: { minWidth: 16, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', flexShrink: 0 },
  // With the label gone the badge no longer follows the text inline; it floats on
  // the icon-only pill's top-right corner so a non-zero count is still visible.
  aiPillBadgeCorner: { position: 'absolute', top: -5, right: 4 },
  aiPillBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  leadsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand },
  leadsBtnText: { fontSize: 11.5, fontWeight: '800', color: colors.brand },
  closeBtn: { padding: 6, borderRadius: 10, backgroundColor: colors.slateBg },
});
