// CRM Leads — AI leads table + Human Lead Manager + Course.
// Opened from the Home dashboard's "CRM" bottom-bar button.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Monitor, Users, GraduationCap, Search, ChevronLeft, ChevronRight, UserPlus,
} from '../../src/icons';
import { crmBridgeApi, CrmLead } from '../../src/lib/api';
import CrmLeadDrawer from '../../src/components/crm/CrmLeadDrawer';
import HumanLeadManager from '../../src/components/crm/HumanLeadManager';
import LeadCourse from '../../src/components/crm/LeadCourse';
import { SkeletonRow } from '../../src/components/Skeleton';
import EmptyState from '../../src/components/EmptyState';
import { colors, FLOAT_NAV_SPACE } from '../../src/theme';
import { useFloatTop } from '../../src/lib/floatChrome';
import { leadsErrorKind, LeadsErrorKind } from '../../src/lib/crmLeadsError';

const STATUS_PILLS = ['All', 'HOT', 'WARM', 'COLD', 'CREATED'];
const STATUS_C: Record<string, { bg: string; text: string; dot: string }> = {
  HOT:     { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
  WARM:    { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  COLD:    { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  CREATED: { bg: '#F5F5F4', text: '#57534E', dot: '#A8A29E' },
};

export default function CrmLeadsScreen({ embedded = false, searchVisible, addLeadSignal = 0, learnSignal = 0, onModeChange }: {
  embedded?: boolean;
  // Bumped by the host header's New Lead / Learn icons (embedded mode).
  addLeadSignal?: number;
  learnSignal?: number;
  // Reports the active mode so the host can highlight its Learn icon.
  onModeChange?: (mode: 'ai' | 'human' | 'course') => void;
  // When embedded, the host header's search icon toggles the search fields.
  // Undefined (standalone route) keeps them always visible.
  searchVisible?: boolean;
} = {}) {
  const showSearch = searchVisible ?? true;
  // Host's floating header pill height (0 on the standalone route).
  const floatTop = useFloatTop();
  // Bumped by the "+" icon after "AI Lead" to open Human Lead's Add Lead sheet.
  const [addSignal, setAddSignal] = useState(0);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<'ai' | 'human' | 'course'>('human');
  useEffect(() => { if (addLeadSignal) { setMode('human'); setAddSignal((n) => n + 1); } }, [addLeadSignal]);
  useEffect(() => { if (learnSignal) setMode('course'); }, [learnSignal]);
  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Previously `catch { setLeads([]) }` — an offline/5xx or NOT_LINKED failure
  // rendered "No leads found", indistinguishable from a real empty result and
  // with no retry. loadError drives an explicit error state instead.
  const [loadError, setLoadError] = useState<LeadsErrorKind | null>(null);

  // Only the newest request may write state. Previously responses applied in
  // arrival order, so a slow page-2 / old-search response could land after a
  // newer one and replace the list with stale rows.
  const reqSeqRef = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  const fetchLeads = useCallback(async (pg: number, q: string, status: string) => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    try {
      const params: any = { page: pg, limit: 20 };
      if (q) params.search = q;
      if (status !== 'All') params.status = status;
      const res = await crmBridgeApi.getLeads(params);
      if (seq !== reqSeqRef.current) return;
      setLeads(res.leads || []);
      setTotalPages(res.pages || 1);
      setLoadError(null);
    } catch (e) {
      if (seq !== reqSeqRef.current) return;
      setLeads([]); setLoadError(leadsErrorKind(e));
    }
    finally { if (seq === reqSeqRef.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (mode === 'ai') fetchLeads(page, search, statusFilter);
  }, [page, statusFilter, mode]);

  // A pending debounce used to fire after the screen unmounted.
  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

  const handleSearch = (t: string) => {
    // Previously setPage(1) ran on every keystroke: from page 2 that fired the
    // page effect immediately (with the half-typed term) and then the debounce
    // fetched again — two requests per search. Now only the debounce acts: it
    // resets the page (the effect then fetches with the final term) or, when
    // already on page 1, fetches directly.
    setSearch(t);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (pageRef.current !== 1) setPage(1);
      else fetchLeads(1, t, statusFilter);
    }, 400);
  };

  const modes: { key: 'ai' | 'human' | 'course'; label: string; Icon: typeof Monitor }[] = [
    // Short labels (user request): "Human Lead" / "AI Lead".
    { key: 'human', label: 'Human Lead', Icon: Users },
    { key: 'ai', label: 'AI Lead', Icon: Monitor },
  ];

  // Human Lead / AI Lead bar. Rendered INSIDE each mode's scroll view (not
  // pinned above it) so it scrolls away with the content.
  const modeBarEl = (
    <>
      {/* Mode toggle */}
      <View style={s.modeBar}>
        {modes.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <Pressable key={key} onPress={() => setMode(key)} style={[s.modeBtn, active && s.modeBtnActive]}>
              <Icon size={15} color={active ? '#1F4D3A' : colors.muted2} />
              <Text style={[s.modeText, active && s.modeTextActive]}>{label}</Text>
              {active && <View style={s.modeDot} />}
            </Pressable>
          );
        })}
        {/* Add Lead / Learn — shown here only on the standalone route; when
            embedded they live in the host header (before Search). */}
        {!embedded && <>
        <Pressable
          onPress={() => { setMode('human'); setAddSignal((n) => n + 1); }}
          style={s.addIconBtn}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Add lead"
        >
          <UserPlus size={22} color="#1F4D3A" strokeWidth={2.3} />
        </Pressable>
        {/* Learn — icon only (was the "Learn" text button inside the list). */}
        <Pressable
          onPress={() => setMode('course')}
          style={s.learnIconBtn}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'course' }}
          accessibilityLabel="Learn about lead qualification"
        >
          {/* Selected state = bolder stroke (no box). */}
          <GraduationCap size={22} color="#1F4D3A" strokeWidth={mode === 'course' ? 2.8 : 2} />
        </Pressable>
        </>}
      </View>
    </>
  );
  // AI Lead search + status pills: part of the AI list header, so they scroll too.
  const aiHeaderEl = (
    <>
          {/* Search (toggled by the header search icon when embedded) */}
          {showSearch && <View style={s.searchWrap}>
            <View style={s.searchRow}>
              <Search size={15} color={colors.muted} />
              <TextInput value={search} onChangeText={handleSearch} placeholder="Search name, phone..."
                placeholderTextColor={colors.muted} style={s.searchInput} />
            </View>
          </View>}

          {/* Status pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={s.pillsScroll}
            contentContainerStyle={s.pillsContent}
          >
            {STATUS_PILLS.map(sp => (
              <Pressable
                key={sp}
                // Previously this called fetchLeads directly AND changed
                // statusFilter/page, which the [page, statusFilter, mode] effect
                // also fetches on, so one tap fired two identical
                // /crm-bridge/leads requests. Now the effect owns the fetch;
                // only a re-tap of the already-active pill on page 1 (no state
                // change, so no effect) fetches here, keeping tap-to-refresh.
                onPress={() => {
                  const same = sp === statusFilter && page === 1;
                  setStatusFilter(sp); setPage(1);
                  if (same) fetchLeads(1, search, sp);
                }}
                style={[s.pill, statusFilter === sp && s.pillActive]}
              >
                {sp !== 'All' && <View style={[s.pillDot, { backgroundColor: STATUS_C[sp]?.dot }]} />}
                <Text style={[s.pillText, statusFilter === sp && s.pillTextActive]}>{sp}</Text>
              </Pressable>
            ))}
          </ScrollView>
    </>
  );

  return (
    <View style={[s.root, { paddingTop: embedded ? 0 : insets.top }]}>

      {/* Header — hidden when embedded inside the Overview tabs */}
      {!embedded && (
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <ChevronLeft size={24} color={colors.ink} />
          </Pressable>
          <View>
            <Text style={s.title}>CRM Pipeline</Text>
            <Text style={s.sub}>Lead intelligence</Text>
          </View>
        </View>
      )}

      {mode === 'ai' && (
        <View style={{ flex: 1 }}>
          {/* Leads */}
          {(
            <FlatList
              data={loading ? [] : leads}
              // Mode bar + search + status pills scroll up with the leads.
              ListHeaderComponent={<View style={{ marginHorizontal: -16 }}>{modeBarEl}{aiHeaderEl}</View>}
              keyExtractor={l => l.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: floatTop, paddingBottom: FLOAT_NAV_SPACE, gap: 8 }}
              ListEmptyComponent={
                loading ? (
                  <View style={{ gap: 8, paddingTop: 4 }}>{[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}</View>
                ) : loadError === 'not_linked' ? (
                  // No Retry: retrying cannot succeed until the account is linked.
                  <EmptyState icon={<Monitor size={28} color={colors.muted} />} title="CRM account not linked" subtitle="Link your CRM account to see leads here." />
                ) : loadError === 'generic' ? (
                  <EmptyState
                    icon={<Monitor size={28} color={colors.muted} />}
                    title="Couldn't load leads"
                    subtitle="Check your connection and try again."
                    actionLabel="Retry"
                    onAction={() => fetchLeads(page, search, statusFilter)}
                  />
                ) : (
                  <EmptyState icon={<Monitor size={28} color={colors.muted} />} title="No leads found" subtitle="Try adjusting search or filter." />
                )
              }
              ListFooterComponent={totalPages > 1 ? (
                <View style={s.pagination}>
                  <Pressable disabled={page <= 1} onPress={() => setPage(p => p - 1)} style={[s.pageBtn, page <= 1 && { opacity: 0.3 }]}>
                    <ChevronLeft size={16} color={'#1F4D3A'} />
                  </Pressable>
                  <Text style={s.pageText}>Page {page} of {totalPages}</Text>
                  <Pressable disabled={page >= totalPages} onPress={() => setPage(p => p + 1)} style={[s.pageBtn, page >= totalPages && { opacity: 0.3 }]}>
                    <ChevronRight size={16} color={'#1F4D3A'} />
                  </Pressable>
                </View>
              ) : null}
              renderItem={({ item: lead }) => {
                const sc = STATUS_C[lead.status] || STATUS_C.CREATED;
                const pct = Math.min(100, lead.score);
                const col = pct >= 70 ? colors.green : pct >= 40 ? colors.amber : colors.red;
                return (
                  <Pressable onPress={() => setSelectedLeadId(lead.id)} style={s.leadCard}>
                    <View style={s.avatar}><Text style={s.avatarText}>{(lead.first_name || '?').charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.leadName} numberOfLines={1}>{lead.first_name} {lead.last_name || ''}</Text>
                      <Text style={s.leadMeta} numberOfLines={1}>{lead.source || 'Unknown'}</Text>
                      <View style={s.scoreTrack}><View style={[s.scoreFill, { width: `${pct}%` as any, backgroundColor: col }]} /></View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 5 }}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <View style={[s.statusDot, { backgroundColor: sc.dot }]} />
                        <Text style={[s.statusText, { color: sc.text }]}>{lead.status}</Text>
                      </View>
                      <Text style={[s.scoreNum, { color: col }]}>{lead.score}pts</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}

      {mode === 'human' && (
        <ScrollView contentContainerStyle={{ paddingTop: floatTop, paddingBottom: FLOAT_NAV_SPACE }} keyboardShouldPersistTaps="handled">{modeBarEl}<HumanLeadManager onNavigateToLearn={() => setMode('course')} openAddSignal={addSignal} showSearch={showSearch} hideAddButton /></ScrollView>
      )}
      {mode === 'course' && (
        <ScrollView contentContainerStyle={{ paddingTop: floatTop, paddingBottom: FLOAT_NAV_SPACE }}>{modeBarEl}<LeadCourse /></ScrollView>
      )}

      <CrmLeadDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  // Boxless icon buttons (no circle / fill) — icon only, green.
  addIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 4 },
  learnIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 2, marginRight: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: '#ECE5D8' },
  backBtn: { padding: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  // Human Lead / AI Lead: one rounded translucent floating pill (same look as
  // the floating footer). No per-button boxes or underline; the active one is
  // green + bold with a small dot.
  // CRM: Human Lead / AI Lead pill closer to the header pill.
  modeBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 6, marginBottom: 2, paddingHorizontal: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(31,77,58,0.10)' },
  modeBtn: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  modeBtnActive: {},
  modeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#1F4D3A' },
  modeText: { fontSize: 13, fontWeight: '600', color: colors.muted2 },
  modeTextActive: { color: '#1F4D3A', fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE5D8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink },
  pillsScroll: { flexGrow: 0, flexShrink: 0 },
  // Tight under the Human Lead / AI Lead pill (user request: less gap).
  pillsContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ECE5D8' },
  pillActive: { backgroundColor: 'transparent', borderColor: '#1F4D3A' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.muted2 },
  // Transparent pills: the active one keeps its green outline + green bold text.
  pillTextActive: { color: '#1F4D3A', fontWeight: '800' },
  // Flat lead row — no card box (user request).
  leadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#ECE5D8' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1F4D3A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  leadName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  leadMeta: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  scoreTrack: { height: 3, borderRadius: 2, backgroundColor: colors.line, marginTop: 5, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  scoreNum: { fontSize: 10, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 14 },
  pageBtn: { padding: 9, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  pageText: { fontSize: 12, fontWeight: '600', color: colors.ink },
});
