// Home tab — the Properties landing page.
//
// Reuses existing pieces only:
//   • data: projectsApiExtended.getAllPublic() (GET /public/projects, the same
//     cached list the Project map uses), so no new endpoint;
//   • details: the existing ProjectDetailsModal (opened by tapping a card);
//   • Map View / Ask AI / Upload / sidebar are handed back to the host
//     (crm.tsx), which switches to the existing Project map, the existing AI
//     Lead Matching assistant, the add-project route and the sidebar.
//
// Sale vs rent: /public/projects has no listing-purpose field (checked against
// the live API: every project carries only projectType/category/propertyType
// like "flat" / "Residential Plot"). A project is treated as a rental only when
// one of those descriptive fields actually says rent/lease; everything else is a
// sale listing. Bathrooms/parking are not in the data either, so they are shown
// only when the project really states them (parking via its amenities) instead
// of inventing numbers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Image, TextInput, Modal,
  RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu, Search, X, MapIcon, SlidersHorizontal, Heart, MapPin,
  BedDouble, Bath, SquareParking, Ruler, RefreshCw, Home, Plus,
} from '../icons';
import { Project, projectsApiExtended, invalidatePublicProjects } from '../lib/api';
import { favouritePropertiesStorage } from '../lib/storage';
import { cleanAreaText } from '../lib/displayText';
import { useAuth } from '../lib/authContext';
import PropertyCoverPlaceholder from './PropertyCoverPlaceholder';
import ProjectDetailsModal from './ProjectDetailsModal';
import PhotoCard from './PhotoCard';

// ── Palette: premium cream + dark green (Properties page only) ──
export const HG = {
  bg: '#EEF3E9',
  card: '#FFFFFF',
  green: '#1F4D3A',
  greenSoft: '#E7F0EA',
  greenLine: '#C9DCCF',
  ink: '#1B2420',
  muted: '#7C847F',
  line: '#ECE5D8',
  heart: '#E0475B',
};

type Category = 'all' | 'sale' | 'rent';
type Sort = 'newest' | 'priceAsc' | 'priceDesc';
type Budget = 'any' | 'u50' | '50to1' | '1to2' | 'o2';
type PType = 'any' | 'flat' | 'plot' | 'villa' | 'commercial';
type Bhk = 'any' | '1' | '2' | '3' | '4';

interface Filters { ptype: PType; budget: Budget; bhk: Bhk; sort: Sort; favOnly: boolean }
const DEFAULT_FILTERS: Filters = { ptype: 'any', budget: 'any', bhk: 'any', sort: 'newest', favOnly: false };

// ── Field helpers ──
const text = (p: Project) =>
  [p.type, p.category, p.propertyType, p.projectStatus].filter(Boolean).join(' ').toLowerCase();

export function listingKind(p: Project): 'sale' | 'rent' {
  return /\b(rent|rental|lease|leasing)\b/.test(`${text(p)} ${p.name || ''}`.toLowerCase()) ? 'rent' : 'sale';
}

function coverOf(p: Project): string | null {
  if (!p.coverImage) return null;
  return typeof p.coverImage === 'string' ? p.coverImage : (p.coverImage as any)?.url ?? null;
}

/** "1800sq" / "1800 sq." / "1800sq ft" → "1800 sqft"; other units pass through. */
function areaText(p: Project): string {
  const raw = String(p.carpetAreaRange || p.plotSizeRange || '').trim();
  const fixed = raw.replace(/\s*sq\.?\s*(ft|feet)?\.?$/i, '').trim();
  return fixed !== raw ? cleanAreaText(fixed) : cleanAreaText(raw);
}

function fmtPrice(n: number | undefined, rent: boolean): string {
  if (!n) return 'Price on request';
  let s: string;
  if (n >= 10000000) s = `₹${(n / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (n >= 100000) s = `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} L`;
  else s = `₹${n.toLocaleString('en-IN')}`;
  return rent ? `${s}/mo` : s;
}

/** BHK numbers present on the project, e.g. ["2 BHK","3 BHK"] → [2,3]. */
function bhkNumbers(p: Project): number[] {
  const out = new Set<number>();
  for (const o of p.bhkOptions || []) {
    const m = String(o).match(/(\d+(?:\.\d+)?)/);
    if (m) out.add(Math.floor(parseFloat(m[1])));
  }
  return [...out].sort((a, b) => a - b);
}

function bedsLabel(p: Project): string {
  const n = bhkNumbers(p);
  if (!n.length) return '';
  return n.length === 1 ? `${n[0]} Bed` : `${n[0]}-${n[n.length - 1]} Beds`;
}

function hasParking(p: Project): boolean {
  return (p.amenities || []).some((a) => /parking|garage/i.test(String(a)));
}

function bathsLabel(p: Project): string {
  // Only when the project explicitly lists bathrooms (e.g. "2 Bathrooms") in amenities.
  const hit = (p.amenities || []).map(String).find((a) => /\d+\s*(bath|bathroom|toilet)/i.test(a));
  if (!hit) return '';
  const m = hit.match(/(\d+)/);
  return m ? `${m[1]} Bath` : '';
}

function ptypeOf(p: Project): PType {
  const t = text(p);
  if (/villa|bungalow|row ?house/.test(t)) return 'villa';
  if (/commercial|retail|office|shop/.test(t) && !/residential/.test(t)) return 'commercial';
  if (/plot|land/.test(t)) return 'plot';
  return 'flat';
}

function inBudget(price: number, b: Budget): boolean {
  if (b === 'any') return true;
  if (!price) return false;
  const L = 100000, CR = 10000000;
  if (b === 'u50') return price < 50 * L;
  if (b === '50to1') return price >= 50 * L && price < CR;
  if (b === '1to2') return price >= CR && price < 2 * CR;
  return price >= 2 * CR;
}

/**
 * One property card (photo on top, details below). Shared by the Home page
 * and the Projects screen so both look identical.
 * `actions` = round icon buttons at the image's top-right (heart on Home;
 * share + menu on Projects). `tag` = an extra small pill beside the
 * For Sale / For Rent badge (e.g. "Draft").
 */
// The old split layout is kept only behind this switch (off) for reference.
const useLegacyCardRef = { current: false };

export function PropertyCard({ project: p, onPress, actions, tag, footerNote, onViewProperty, onShare }: {
  project: Project;
  onPress: () => void;
  actions?: React.ReactNode;
  tag?: string;
  footerNote?: string;
  onViewProperty?: () => void;
  onShare?: () => void;
}) {
  const rent = listingKind(p) === 'rent';
  const cover = coverOf(p);
  const area = areaText(p);
  const place = [p.location, p.city].filter(Boolean).join(', ');
  const beds = (p.bhkOptions || []).filter(Boolean).join(', ');
  // Property type label: Apartment / Plot / Villa / Commercial / Flat
  const typeLabelRaw = p.propertyType || p.category || '';
  const typeLabel = typeLabelRaw
    ? typeLabelRaw.charAt(0).toUpperCase() + typeLabelRaw.slice(1).toLowerCase()
    : (p.type === 'plot' ? 'Plot' : 'Apartment');
  const statusLabel = (() => {
    const st = String(p.projectStatus || '').toLowerCase();
    if (st.includes('ready') || st.includes('move')) return 'Ready to Move';
    if (st.includes('construction') || st.includes('construct')) return 'Under Construction';
    if (st.includes('launch')) return 'Pre Launch';
    return '';
  })();
  // Per-sqft display
  const perSqft = (() => {
    if (!p.startingPrice) return '';
    const areaStr = area.replace(/[^0-9–\-]/g, '');
    const nums = areaStr.split(/–|-/).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (avg < 100) return '';
    const psf = Math.round(p.startingPrice / avg);
    if (psf < 100) return '';
    return `₹${psf.toLocaleString('en-IN')}/sqft`;
  })();
  return (
    <PhotoCard
      image={cover}
      seed={p.id || p.name}
      tag={undefined}
      price={p.startingPrice ? fmtPrice(p.startingPrice, rent) : undefined}
      pricePerSqft={perSqft || undefined}
      status={statusLabel || undefined}
      listingLabel={rent ? 'For Rent' : 'For Sale'}
      chips={[beds, area, typeLabel]}
      title={p.name}
      location={place || 'Location on request'}
      actions={actions}
      onPress={onPress}
      onViewProperty={onViewProperty}
      onChat={onShare}
      imageHeight={110}
      footer={!!footerNote ? (
        <Text style={{ fontSize: 11, color: '#1F4D3A', marginTop: 2 }} numberOfLines={1}>● {footerNote}</Text>
      ) : undefined}
      accessibilityLabel={`${p.name}, ${rent ? 'for rent' : 'for sale'}, ${fmtPrice(p.startingPrice, rent)}`}
    />
  );
}
/** Transparent icon button for PropertyCard's top-right corner (share, more). */
export function CardIconButton({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable style={st.heartBtn} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

export default function PropertiesHome({
  canUpload, onUpload, onOpenSidebar, onAskAI, onOpenMap,
}: {
  canUpload: boolean;
  onUpload: () => void;
  onOpenSidebar: () => void;
  onAskAI: () => void;
  onOpenMap: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [detail, setDetail] = useState<Project | null>(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      if (force) invalidatePublicProjects();
      const list = await projectsApiExtended.getAllPublic();
      setProjects(list.filter((p) => p.id));
    } catch (e: any) {
      setError(e?.message || 'Could not load properties.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { favouritePropertiesStorage.get(userId).then(setFavs); }, [userId]);

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      favouritePropertiesStorage.set(userId, next);
      return next;
    });
  };

  const counts = useMemo(() => {
    let sale = 0, rent = 0;
    for (const p of projects) (listingKind(p) === 'rent' ? rent++ : sale++);
    return { all: projects.length, sale, rent };
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (category !== 'all' && listingKind(p) !== category) return false;
      if (filters.favOnly && !favs.includes(p.id)) return false;
      if (filters.ptype !== 'any' && ptypeOf(p) !== filters.ptype) return false;
      if (!inBudget(p.startingPrice, filters.budget)) return false;
      if (filters.bhk !== 'any') {
        const n = bhkNumbers(p);
        const want = parseInt(filters.bhk, 10);
        if (!(want === 4 ? n.some((x) => x >= 4) : n.includes(want))) return false;
      }
      if (q) {
        const hay = `${p.name} ${p.location} ${p.city} ${p.propertyType || ''} ${p.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (filters.sort === 'priceAsc') list = [...list].sort((a, b) => (a.startingPrice || Infinity) - (b.startingPrice || Infinity));
    else if (filters.sort === 'priceDesc') list = [...list].sort((a, b) => (b.startingPrice || 0) - (a.startingPrice || 0));
    else list = [...list].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return list;
  }, [projects, category, query, filters, favs]);

  const activeFilterCount =
    (filters.ptype !== 'any' ? 1 : 0) + (filters.budget !== 'any' ? 1 : 0) +
    (filters.bhk !== 'any' ? 1 : 0) + (filters.sort !== 'newest' ? 1 : 0) + (filters.favOnly ? 1 : 0);

  const renderCard = ({ item: p }: { item: Project }) => {
    const fav = favs.includes(p.id);
    return (
      <PropertyCard
        project={p}
        onPress={() => setDetail(p)}
        actions={
          <Pressable
            style={st.heartBtn}
            onPress={() => toggleFav(p.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={fav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart size={18} color={fav ? HG.heart : HG.ink} fill={fav ? HG.heart : 'transparent'} />
          </Pressable>
        }
      />
    );
  };

  // The property list. `top` (search field + category tabs) is its scrolling
  // header, so only the page header and the app footer stay fixed. Loading /
  // error states show `top` above them in a plain scroll view.
  const renderList = (top: React.ReactNode) => {
    if (loading || (error && projects.length === 0)) {
      return (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {top}
          {loading ? (
            <View style={st.center}><ActivityIndicator color={HG.green} /></View>
          ) : (
            <View style={st.center}>
              <Text style={st.emptyTitle}>Could not load properties</Text>
              <Text style={st.emptySub}>{error}</Text>
              <Pressable style={st.retry} onPress={() => { setLoading(true); load(true); }}>
                <RefreshCw size={14} color="#fff" /><Text style={st.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      );
    }
    return (
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={renderCard}
        ListHeaderComponent={<>{top}</>}
        // The tabs carry their own 18px side margin; cancel the list padding.
        ListHeaderComponentStyle={{ marginHorizontal: -16 }}
        contentContainerStyle={[st.list, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[HG.green]} tintColor={HG.green} />}
        ListEmptyComponent={
          <View style={st.center}>
            <Text style={st.emptyTitle}>
              {category === 'rent' ? 'No rental properties yet' : 'No properties found'}
            </Text>
            <Text style={st.emptySub}>
              {category === 'rent'
                ? 'Rental listings will appear here once they are uploaded.'
                : 'Try changing the search or filter settings.'}
            </Text>
          </View>
        }
      />
    );
  };

  const Chip = ({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: React.ReactNode }) => (
    <Pressable
      style={[st.chip, active && st.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[st.chipText, active && st.chipTextActive]}>{label}</Text>
      {active && <View style={st.chipUnderline} />}
    </Pressable>
  );

  const Opt = <T extends string>({ value, current, label, onPick }: { value: T; current: T; label: string; onPick: (v: T) => void }) => (
    <Pressable
      style={[st.opt, value === current && st.optActive]}
      onPress={() => onPick(value)}
      accessibilityRole="button"
      accessibilityState={{ selected: value === current }}
    >
      <Text style={[st.optText, value === current && st.optTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={st.root}>
      {/* ── Header: menu · Properties · Upload ── */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Pressable onPress={onOpenSidebar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open menu">
            <Menu size={22} color={HG.ink} />
          </Pressable>
          {/* App brand: home logo + name (was the "Properties" heading). */}
          <View style={st.logoBox}><Home size={20} color="#fff" strokeWidth={2.4} /></View>
          <Text style={st.title}>HomeInTown</Text>
        </View>
        {/* Search · Filter · Upload, all in the header (search + filter sit
            just before the upload "+"). */}
        <View style={st.headerRight}>
          <Pressable style={st.settingsBtn} onPress={() => setShowSearch((v) => !v)} hitSlop={6}
            accessibilityRole="button" accessibilityLabel={showSearch ? 'Close search' : 'Search properties'}>
            <Search size={21} color={HG.green} strokeWidth={showSearch ? 2.8 : 2} />
          </Pressable>
          <Pressable
            style={st.settingsBtn}
            onPress={() => { setDraft(filters); setShowFilters(true); }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Filter settings"
          >
            <SlidersHorizontal size={21} color={HG.green} strokeWidth={activeFilterCount > 0 ? 2.8 : 2} />
            {activeFilterCount > 0 && <View style={st.filterDot}><Text style={st.filterDotText}>{activeFilterCount}</Text></View>}
          </Pressable>
          {canUpload && (
            <Pressable style={st.upload} onPress={onUpload} hitSlop={8} accessibilityRole="button" accessibilityLabel="Upload property">
              <Plus size={22} color="#fff" strokeWidth={2.6} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Only the header above (and the app footer) stay fixed; the search
          field and category tabs scroll together with the property list. */}
      {renderList(<>
      {/* Search field — opened by the header search icon. */}
      {showSearch && (
      <View style={st.toolRow}>
          <View style={st.searchBox}>
            <Search size={16} color={HG.muted} />
            <TextInput
              style={st.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, area, city"
              placeholderTextColor={HG.muted}
              autoFocus
              returnKeyType="search"
            />
            <Pressable onPress={() => { setQuery(''); setShowSearch(false); }} hitSlop={8} accessibilityLabel="Close search">
              <X size={16} color={HG.muted} />
            </Pressable>
          </View>
      </View>
      )}

      {/* ── Filters row ── */}
      <View style={st.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterRow}>
          <Chip label="All Properties" active={category === 'all'} onPress={() => setCategory('all')} />
          <Chip label="For Sale" active={category === 'sale'} onPress={() => setCategory('sale')} />
          <Chip label="For Rent" active={category === 'rent'} onPress={() => setCategory('rent')} />
          <Chip label="Map View" active={false} onPress={onOpenMap} icon={<MapIcon size={15} color={HG.green} />} />
        </ScrollView>
      </View>
      </>)}

      {/* ── Filter settings sheet ── */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={st.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilters(false)} />
          <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Filter settings</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={10} accessibilityLabel="Close"><X size={20} color={HG.ink} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={st.group}>Property type</Text>
              <View style={st.opts}>
                {([['any', 'Any'], ['flat', 'Flat'], ['plot', 'Plot'], ['villa', 'Villa'], ['commercial', 'Commercial']] as [PType, string][]).map(([v, l]) => (
                  <Opt key={v} value={v} current={draft.ptype} label={l} onPick={(x) => setDraft((d) => ({ ...d, ptype: x }))} />
                ))}
              </View>
              <Text style={st.group}>Budget</Text>
              <View style={st.opts}>
                {([['any', 'Any'], ['u50', 'Under 50 L'], ['50to1', '50 L – 1 Cr'], ['1to2', '1 – 2 Cr'], ['o2', '2 Cr+']] as [Budget, string][]).map(([v, l]) => (
                  <Opt key={v} value={v} current={draft.budget} label={l} onPick={(x) => setDraft((d) => ({ ...d, budget: x }))} />
                ))}
              </View>
              <Text style={st.group}>Bedrooms</Text>
              <View style={st.opts}>
                {([['any', 'Any'], ['1', '1 BHK'], ['2', '2 BHK'], ['3', '3 BHK'], ['4', '4+ BHK']] as [Bhk, string][]).map(([v, l]) => (
                  <Opt key={v} value={v} current={draft.bhk} label={l} onPick={(x) => setDraft((d) => ({ ...d, bhk: x }))} />
                ))}
              </View>
              <Text style={st.group}>Sort by</Text>
              <View style={st.opts}>
                {([['newest', 'Newest'], ['priceAsc', 'Price: Low to High'], ['priceDesc', 'Price: High to Low']] as [Sort, string][]).map(([v, l]) => (
                  <Opt key={v} value={v} current={draft.sort} label={l} onPick={(x) => setDraft((d) => ({ ...d, sort: x }))} />
                ))}
              </View>
              <Text style={st.group}>Show</Text>
              <View style={st.opts}>
                <Opt value="all" current={draft.favOnly ? 'fav' : 'all'} label="All" onPick={() => setDraft((d) => ({ ...d, favOnly: false }))} />
                <Opt value="fav" current={draft.favOnly ? 'fav' : 'all'} label="Favourites only" onPick={() => setDraft((d) => ({ ...d, favOnly: true }))} />
              </View>
            </ScrollView>
            <View style={st.sheetActions}>
              <Pressable style={st.resetBtn} onPress={() => setDraft(DEFAULT_FILTERS)}><Text style={st.resetText}>Reset</Text></Pressable>
              <Pressable style={st.applyBtn} onPress={() => { setFilters(draft); setShowFilters(false); }}><Text style={st.applyText}>Apply</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Existing Property Details screen, in the Home page's green theme */}
      <ProjectDetailsModal project={detail} onClose={() => setDetail(null)} variant="green" />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: HG.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: '800', color: HG.ink, letterSpacing: 0.2, flexShrink: 1 },
  logoBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: HG.green, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  // Green circular "+" button (same as the My Group / CRM header).
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upload: { marginLeft: 4, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: HG.green, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: HG.card, borderWidth: 1, borderColor: HG.line },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, borderRadius: 19, paddingHorizontal: 12, backgroundColor: HG.card, borderWidth: 1, borderColor: HG.greenLine },
  searchInput: { flex: 1, fontSize: 14, color: HG.ink, paddingVertical: 0 },
  askAi: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 8 },
  askAiText: { fontSize: 14, fontWeight: '700', color: HG.green },

  filterWrap: { marginHorizontal: 18, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: HG.line },
  filterRow: { gap: 14, alignItems: 'center' },
  // Boxless text tabs: no border/background; the active one is dark green, bold
  // and underlined with a short green bar.
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, position: 'relative' },
  chipActive: {},
  chipText: { fontSize: 14, fontWeight: '600', color: HG.muted },
  chipUnderline: { position: 'absolute', left: 6, right: 6, bottom: 0, height: 3, borderRadius: 2, backgroundColor: HG.green },
  countText: { fontSize: 12, color: HG.muted, paddingHorizontal: 18, paddingBottom: 8 },
  chipTextActive: { color: HG.green, fontWeight: '800' },
  // Boxless filter icon (no circle / fill); active state = bolder stroke + count dot.
  settingsBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  settingsBtnActive: {},
  filterDot: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: HG.heart, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  list: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  // No card box (user request): no background, border or shadow. The photo
  // keeps its own rounded corners; details sit directly on the page, and a
  // hairline separates one property from the next.
  // Soft card box: slightly transparent white on the cream page, a faint green
  // border and a light shadow (shared by Projects / Marketplace cards).
  card: {
    padding: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#1F4D3A', shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 0,
  },
  imgWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  img: { width: '100%', height: 200, backgroundColor: HG.greenSoft },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeSale: { backgroundColor: HG.green },
  badgeRent: { backgroundColor: '#FFFFFFEE', borderWidth: 1, borderColor: HG.greenLine },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  // Badges row (For Sale/Rent + optional tag) and the right-side action icons.
  badgeRow: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  badgeInline: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  actions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  footerNote: { fontSize: 12, color: HG.green, fontWeight: '700', marginTop: 2 },
  // Round white icon button on the photo (heart, share, menu). Positioned by
  // the `actions` row, so it is not absolute itself.
  heartBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFFF2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  body: { paddingHorizontal: 2, paddingTop: 12, gap: 6 },
  name: { fontSize: 17, fontWeight: '800', color: HG.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12.5, color: HG.muted, flexShrink: 1 },
  metaArea: { fontSize: 12.5, color: HG.muted, flexShrink: 0, maxWidth: '45%' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: HG.muted, marginHorizontal: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: HG.line, gap: 8 },
  features: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexWrap: 'wrap' },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featText: { fontSize: 12.5, color: HG.ink, fontWeight: '600' },
  price: { fontSize: 17, fontWeight: '800', color: HG.green },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: HG.ink, textAlign: 'center' },
  emptySub: { fontSize: 12.5, color: HG.muted, marginTop: 6, textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: HG.green, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: HG.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: HG.ink },
  group: { fontSize: 13, fontWeight: '700', color: HG.muted, marginTop: 14, marginBottom: 8 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: HG.card, borderWidth: 1, borderColor: HG.line },
  optActive: { backgroundColor: HG.green, borderColor: HG.green },
  optText: { fontSize: 13, color: HG.ink, fontWeight: '600' },
  optTextActive: { color: '#fff' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  resetBtn: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: HG.greenLine, backgroundColor: HG.card },
  resetText: { fontSize: 14, fontWeight: '700', color: HG.green },
  applyBtn: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: HG.green },
  applyText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
