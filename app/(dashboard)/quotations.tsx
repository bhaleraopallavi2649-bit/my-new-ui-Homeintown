// Meri Quotations — the quotations this user created (GET /quotations is
// own-only), filterable by status, with a detail sheet to mark a quotation
// accepted / rejected / cancelled and to re-share its PDF.
//
// "Expired" is never stored: the server derives it (a `sent` quotation past
// validUntil) and returns it as effectiveStatus, so the pill reads that.
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { FileText, Plus, X, Share2 } from '../../src/icons';
import {
  quotationsApi, ApiError, Quotation, QuotationListItem, QuotationStatus,
  QuotationEffectiveStatus, QuotationStatusFilter,
} from '../../src/lib/api';
import { formatINR, formatDateIN } from '../../src/lib/inr';
import { shareQuotationPdf } from '../../src/lib/quotationPdf';
import CostSheet from '../../src/components/quotation/CostSheet';
import EmptyState from '../../src/components/EmptyState';
import MenuButton from '../../src/components/MenuButton';
import { useToast } from '../../src/components/Toast';
import { colors, radius, spacing } from '../../src/theme';

const NOT_LIVE = 'Quotation feature abhi server pe live nahi hai';

const FILTERS: { key: QuotationStatusFilter | undefined; label: string }[] = [
  { key: undefined, label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'expired', label: 'Expired' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PILL: Record<QuotationEffectiveStatus, { bg: string; fg: string; border: string; label: string }> = {
  sent: { bg: colors.blueBg, fg: colors.blueText, border: colors.blueBorder, label: 'Sent' },
  expired: { bg: colors.amberBg, fg: colors.amberText, border: colors.amberBorder, label: 'Expired' },
  accepted: { bg: colors.greenBg, fg: colors.greenText, border: colors.greenBorder, label: 'Accepted' },
  rejected: { bg: colors.redBg, fg: colors.redText, border: colors.redBorder, label: 'Rejected' },
  cancelled: { bg: colors.slateBg, fg: colors.slateText, border: colors.slateBorder, label: 'Cancelled' },
};

const ACTIONS: { status: QuotationStatus; label: string }[] = [
  { status: 'accepted', label: 'Accepted' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'cancelled', label: 'Cancel' },
];

function errMsg(e: any, fallback: string): string {
  // Until the backend is deployed prod answers { error: 'Route not found' }.
  if (e instanceof ApiError && e.status === 404 && e.data?.error === 'Route not found') return NOT_LIVE;
  return e?.message || fallback;
}

function StatusPill({ status }: { status: QuotationEffectiveStatus }) {
  const p = PILL[status] || PILL.sent;
  return (
    <View style={[s.pill, { backgroundColor: p.bg, borderColor: p.border }]}>
      <Text style={[s.pillText, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
}

const unitLine = (u: QuotationListItem['unit']) =>
  [u?.tower, u?.label, u?.bhk, u?.floor != null ? `Floor ${u.floor}` : null].filter(Boolean).join(' · ');

export default function QuotationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<QuotationStatusFilter | undefined>(undefined);
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every reset (filter chip, refresh, focus) bumps this, so a response for an
  // older filter or page that lands late is dropped instead of mixing lists.
  const reqRef = useRef(0);
  const moreInFlight = useRef(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Quotation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<null | QuotationStatus | 'pdf'>(null);

  const loadFirst = useCallback(async (f: QuotationStatusFilter | undefined, mode: 'initial' | 'refresh') => {
    const id = ++reqRef.current;
    moreInFlight.current = false;
    setLoadingMore(false);
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await quotationsApi.list({ status: f, page: 1 });
      if (id !== reqRef.current) return;
      setItems(res.quotations);
      setPage(1);
      setHasMore(res.hasMore);
    } catch (e: any) {
      if (id !== reqRef.current) return;
      setItems([]);
      setHasMore(false);
      setError(errMsg(e, 'Quotations load nahi hui'));
    } finally {
      if (id === reqRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const loadMore = async () => {
    if (!hasMore || loading || refreshing || moreInFlight.current) return;
    moreInFlight.current = true;
    const id = reqRef.current;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const res = await quotationsApi.list({ status: filter, page: next });
      if (id !== reqRef.current) return;
      setItems(prev => {
        const seen = new Set(prev.map(q => q.id));
        return [...prev, ...res.quotations.filter(q => !seen.has(q.id))];
      });
      setPage(next);
      setHasMore(res.hasMore);
    } catch (e: any) {
      if (id === reqRef.current) toast.show(errMsg(e, 'Aur quotations load nahi hui'), 'error');
    } finally {
      if (id === reqRef.current) { moreInFlight.current = false; setLoadingMore(false); }
    }
  };

  // Reload on focus as well as on filter change, so a quotation created in the
  // wizard is in the list when the user comes back.
  useFocusEffect(useCallback(() => { loadFirst(filter, 'initial'); }, [filter, loadFirst]));

  // The sheet may be closed or switched to another row before get() answers.
  const openIdRef = useRef<string | null>(null);
  const openDetail = async (id: string) => {
    openIdRef.current = id;
    setOpenId(id);
    setFull(null);
    setDetailLoading(true);
    try {
      const q = await quotationsApi.get(id);
      if (openIdRef.current === id) setFull(q);
    } catch (e: any) {
      if (openIdRef.current !== id) return;
      toast.show(errMsg(e, 'Quotation load nahi hui'), 'error');
      openIdRef.current = null;
      setOpenId(null);
    } finally {
      if (openIdRef.current === id || openIdRef.current === null) setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (busy) return;
    openIdRef.current = null;
    setOpenId(null);
    setFull(null);
  };

  const applyStatus = async (status: QuotationStatus) => {
    if (!full || busy) return;
    setBusy(status);
    try {
      const q = await quotationsApi.updateStatus(full.id, status);
      setFull(q);
      // Patch the row in place; drop it when the active filter no longer matches.
      setItems(prev => prev
        .map(r => (r.id === q.id ? { ...r, status: q.status, effectiveStatus: q.effectiveStatus } : r))
        .filter(r => r.id !== q.id || !filter || r.effectiveStatus === filter));
      toast.show('Status update ho gaya ✓', 'success');
    } catch (e: any) {
      // 409 = already cancelled; the server's sentence says so.
      toast.show(errMsg(e, 'Status update nahi hua'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const onAction = (status: QuotationStatus) => {
    if (status !== 'cancelled') { applyStatus(status); return; }
    Alert.alert('Quotation cancel karein?', 'Cancel ke baad status badal nahi sakte', [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Cancel karo', style: 'destructive', onPress: () => applyStatus('cancelled') },
    ]);
  };

  const onSharePdf = async () => {
    if (!full || busy) return;
    setBusy('pdf');
    try { await shareQuotationPdf(full); } catch (e: any) { toast.show(e?.message || 'PDF share nahi hua', 'error'); } finally { setBusy(null); }
  };

  const goNew = () => router.push('/(dashboard)/quotation-new' as any);
  const filterLabel = FILTERS.find(f => f.key === filter)?.label;

  const renderRow = ({ item }: { item: QuotationListItem }) => {
    const unit = unitLine(item.unit);
    return (
      <Pressable style={s.row} onPress={() => openDetail(item.id)} accessibilityRole="button">
        <View style={s.rowTop}>
          <Text style={s.number}>{item.number}</Text>
          <StatusPill status={item.effectiveStatus} />
        </View>
        <Text style={s.project} numberOfLines={1}>{item.projectSnapshot?.projectName || 'Project'}</Text>
        {!!unit && <Text style={s.muted} numberOfLines={1}>{unit}</Text>}
        {!!item.buyer?.name && <Text style={s.muted} numberOfLines={1}>Buyer: {item.buyer.name}</Text>}
        <View style={s.rowTop}>
          <Text style={s.total}>{formatINR(item.totals.grandTotal)}</Text>
          <Text style={s.hint}>Valid till {formatDateIN(item.validUntil)}</Text>
        </View>
      </Pressable>
    );
  };

  const renderDetail = () => {
    if (detailLoading || !full) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;
    const unit = unitLine(full.unit);
    // Nothing can change a cancelled quotation (server answers 409).
    const actions = full.status === 'cancelled' ? [] : ACTIONS.filter(a => a.status !== full.status);
    return (
      <ScrollView contentContainerStyle={s.sheetBody}>
        <Text style={s.project}>{full.projectSnapshot?.projectName || 'Project'}</Text>
        {!!unit && <Text style={s.muted}>{unit}</Text>}
        <Text style={s.muted}>Carpet {full.inputs?.carpetSqFt} sq.ft</Text>
        {!!full.buyer?.name && <Text style={s.muted}>Buyer: {full.buyer.name}{full.buyer.phone ? ` · ${full.buyer.phone}` : ''}</Text>}
        <Text style={s.hint}>Valid till {formatDateIN(full.validUntil)}</Text>

        <View style={s.box}>
          <CostSheet lines={full.lines || []} taxes={full.taxes || []} totals={full.totals} />
        </View>

        {!!full.paymentPlan && (
          <View style={s.box}>
            <Text style={s.sectionLabel}>Payment plan</Text>
            <Text style={s.body}>{full.paymentPlan}</Text>
          </View>
        )}
        {!!full.remarks && (
          <View style={s.box}>
            <Text style={s.sectionLabel}>Remarks</Text>
            <Text style={s.body}>{full.remarks}</Text>
          </View>
        )}

        <Pressable style={[s.primaryBtn, !!busy && s.dim]} onPress={onSharePdf} disabled={!!busy} accessibilityRole="button">
          {busy === 'pdf' ? <ActivityIndicator size="small" color={colors.white} /> : <Share2 size={15} color={colors.white} />}
          <Text style={s.primaryText}>PDF dobara bhejo</Text>
        </Pressable>

        {actions.length > 0 && (
          <View style={s.actions}>
            {actions.map(a => (
              <Pressable
                key={a.status}
                style={[s.actionBtn, a.status === 'cancelled' && s.actionDanger, !!busy && s.dim]}
                onPress={() => onAction(a.status)}
                disabled={!!busy}
                accessibilityRole="button"
              >
                {busy === a.status
                  ? <ActivityIndicator size="small" color={colors.brand} />
                  : <Text style={[s.actionText, a.status === 'cancelled' && { color: colors.redText }]}>{a.label}</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <MenuButton />
        <Text style={s.title}>Meri Quotations</Text>
        <Pressable onPress={goNew} hitSlop={8} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Nayi quotation">
          <Plus size={18} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsBar} contentContainerStyle={s.chips}>
        {FILTERS.map(f => {
          const selected = f.key === filter;
          return (
            <Pressable
              key={f.label}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[s.chip, selected && s.chipSelected]}
            >
              <Text style={[s.chipText, selected && s.chipTextSelected]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={q => q.id}
          renderItem={renderRow}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(filter, 'refresh')} colors={[colors.brand]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} /> : null}
          ListEmptyComponent={error ? (
            <EmptyState
              icon={<FileText size={28} color={colors.brand} />}
              title={error}
              subtitle="Thodi der baad dobara try karo."
              actionLabel="Retry"
              onAction={() => loadFirst(filter, 'initial')}
            />
          ) : (
            <EmptyState
              icon={<FileText size={28} color={colors.brand} />}
              title={filter ? `Koi ${filterLabel} quotation nahi` : 'Abhi koi quotation nahi'}
              subtitle="Project chuno, details bharo aur PDF WhatsApp pe bhejo."
              actionLabel="Nayi quotation"
              onAction={goNew}
            />
          )}
        />
      )}

      <Modal visible={!!openId} transparent animationType="slide" onRequestClose={closeDetail}>
        <Pressable style={s.overlay} onPress={closeDetail}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.number}>{full?.number || ''}</Text>
              {!!full && <StatusPill status={full.effectiveStatus} />}
              <Pressable onPress={closeDetail} hitSlop={8} style={{ marginLeft: 'auto' }} accessibilityRole="button" accessibilityLabel="Close">
                <X size={20} color={colors.ink} />
              </Pressable>
            </View>
            {renderDetail()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { flex: 1, fontSize: 21, fontWeight: '800', color: colors.ink },
  addBtn: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  center: { paddingVertical: 60, alignItems: 'center' },

  chipsBar: { flexGrow: 0, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.white },

  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  number: { fontSize: 13, fontWeight: '800', color: colors.ink },
  project: { fontSize: 14, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 12, color: colors.muted2 },
  hint: { fontSize: 11, color: colors.muted },
  total: { fontSize: 15, fontWeight: '800', color: colors.brand },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetBody: { padding: spacing.lg, gap: spacing.md },
  box: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: colors.muted2, textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { fontSize: 12, color: colors.ink, lineHeight: 18 },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.md },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.white },
  actionDanger: { borderColor: colors.redBorder },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  dim: { opacity: 0.4 },
});
