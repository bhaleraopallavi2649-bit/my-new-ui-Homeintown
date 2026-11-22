// Full project details popup — opens from the Projects list (grid + list views).
// Shows cover, gallery, pricing, configuration, amenities, RERA and status.

import React, { useRef, useState } from 'react';
import SlidePageModal from './SlidePageModal';
import {
  Modal, View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions, Linking, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, MapPin, IndianRupee, BedDouble, Ruler, CheckCircle,
  Building2, Layers, Compass, Landmark, Phone, MessageCircle, ShieldCheck,
  Navigation, Check, Users,
} from '../icons';
import { Project } from '../lib/api';
import { colors } from '../theme';
import PropertyCoverPlaceholder from './PropertyCoverPlaceholder';
import { cleanAreaText } from '../lib/displayText';

const { width: SCREEN_W } = Dimensions.get('window');

function fmtPrice(n?: number): string {
  if (!n) return 'POA';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function coverOf(p: Project): string | null {
  if (!p.coverImage) return null;
  return typeof p.coverImage === 'string' ? p.coverImage : (p.coverImage as any).url ?? null;
}

function urlOf(m: any): string | null {
  if (!m) return null;
  return typeof m === 'string' ? m : m.url ?? null;
}

function statusLabel(s: string): string {
  if (s === 'ready-to-move' || s === 'ready') return 'Ready to Move';
  if (s === 'under-construction') return 'Under Construction';
  if (s === 'pre-launch') return 'Pre Launch';
  return s;
}

function propertyLabel(p: Project): string {
  if (p.propertyType) return p.propertyType;
  if (p.category) return p.category;
  if (p.type === 'plot') return 'Plot';
  return 'Apartment';
}

/** Primary action pinned to the bottom of the green details screen. */
export type DetailsAction = { label: string; kind: 'join' | 'chat'; onPress: () => void; loading?: boolean };

export default function ProjectDetailsModal({ project, onClose, variant = 'default', action, loading = false }: {
  project: Project | null;
  onClose: () => void;
  // 'green' = the Home / Properties page's premium cream + dark-green layout.
  // 'default' keeps the original warm layout used by the Projects screen.
  variant?: 'default' | 'green';
  // Green variant only: Join Group / Open Group Chat button (Lead Match).
  action?: DetailsAction;
  // Green variant only: real data still loading (shows a small indicator).
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Green page keeps the last project while it slides out to the right.
  const lastProjectRef = useRef<Project | null>(null);
  if (project) lastProjectRef.current = project;
  if (variant === 'green') {
    const shown = project || lastProjectRef.current;
    if (!shown) return null;
    return <GreenDetails visible={!!project} project={shown} onClose={onClose} bottomInset={insets.bottom} topInset={insets.top} action={action} loading={loading} />;
  }
  if (!project) return null;

  const cover = coverOf(project);
  const gallery = (project.galleryImages || []).map(urlOf).filter(Boolean) as string[];

  return (
    <Modal visible={!!project} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <Pressable style={m.backdropTouch} onPress={onClose} />
        <View style={m.sheet}>
          {/* Grabber + close */}
          <View style={m.topBar}>
            <View style={m.grabber} />
            <Pressable onPress={onClose} hitSlop={10} style={m.closeBtn}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={m.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            {/* Cover. Real cover renders as before; no-cover shows the decision-2b
                placeholder sized to the cover slot — NOT a fake stock photo. */}
            {cover ? (
              <Image source={{ uri: cover }} style={m.cover} resizeMode="cover" />
            ) : (
              <PropertyCoverPlaceholder style={m.cover} seed={(project as any).id || project.name} />
            )}

            <View style={m.pad}>
              {/* Title + location */}
              <Text style={m.name}>{project.name}</Text>
              <View style={m.locRow}>
                <MapPin size={14} color={colors.brand} />
                <Text style={m.loc}>{project.location ? `${project.location}, ` : ''}{project.city}</Text>
              </View>

              {/* Badges */}
              <View style={m.badgeRow}>
                <View style={[m.badge, project.isPublished ? m.badgeLive : m.badgeDraft]}>
                  <Text style={[m.badgeText, { color: project.isPublished ? colors.greenText : colors.muted2 }]}>
                    {project.isPublished ? 'Published' : 'Draft'}
                  </Text>
                </View>
                <View style={[m.badge, m.badgeNeutral]}>
                  <Text style={[m.badgeText, { color: '#6E5B43' }]}>{statusLabel(project.projectStatus)}</Text>
                </View>
                {project.reraApproved && (
                  <View style={[m.badge, m.badgeRera]}>
                    <CheckCircle size={11} color={colors.brand} />
                    <Text style={[m.badgeText, { color: colors.brand }]}>RERA</Text>
                  </View>
                )}
              </View>

              {/* Price highlight */}
              <View style={m.priceCard}>
                <IndianRupee size={18} color={colors.brand} />
                <View>
                  <Text style={m.priceLabel}>Starting Price</Text>
                  <Text style={m.priceValue}>{fmtPrice(project.startingPrice)}</Text>
                </View>
                {project.pricePerSqFt ? (
                  <View style={m.pricePerSqft}>
                    <Text style={m.priceLabel}>Per sq ft</Text>
                    <Text style={m.priceValueSmall}>₹{project.pricePerSqFt.toLocaleString('en-IN')}</Text>
                  </View>
                ) : null}
              </View>

              {/* Key details grid */}
              <Text style={m.sectionTitle}>Overview</Text>
              <View style={m.grid}>
                <Detail icon={<Building2 size={15} color={colors.brand} />} label="Property Type" value={propertyLabel(project)} />
                <Detail icon={<Layers size={15} color={colors.brand} />} label="Status" value={statusLabel(project.projectStatus)} />
                {project.bhkOptions?.length ? (
                  <Detail icon={<BedDouble size={15} color={colors.brand} />} label="Configuration" value={project.bhkOptions.join(', ')} />
                ) : null}
                {/* Previous behaviour: `project.carpetAreaRange ?` passed for a
                    literal "undefined" string and rendered it as the Carpet Area
                    value. cleanAreaText collapses those placeholders to '' so the
                    whole Detail row is omitted. */}
                {cleanAreaText(project.carpetAreaRange) ? (
                  <Detail icon={<Ruler size={15} color={colors.brand} />} label="Carpet Area" value={cleanAreaText(project.carpetAreaRange)} />
                ) : null}
                {project.gatedCommunity ? (
                  <Detail icon={<Compass size={15} color={colors.brand} />} label="Community" value="Gated Community" />
                ) : null}
                {project.reraNumber ? (
                  <Detail icon={<Landmark size={15} color={colors.brand} />} label="RERA No." value={project.reraNumber} />
                ) : null}
                <Detail icon={<IndianRupee size={15} color={colors.brand} />} label="Bank Loan" value={project.bankLoanAvailable ? 'Available' : 'Not available'} />
              </View>

              {/* Amenities */}
              {project.amenities?.length ? (
                <>
                  <Text style={m.sectionTitle}>Amenities</Text>
                  <View style={m.chipsWrap}>
                    {project.amenities.map((a) => (
                      <View key={a} style={m.amenityChip}>
                        <Text style={m.amenityText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {/* Gallery */}
              {gallery.length ? (
                <>
                  <Text style={m.sectionTitle}>Gallery</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {gallery.map((g, i) => (
                      <Image key={i} source={{ uri: g }} style={m.galleryImg} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {/* Owner */}
              {project.owner?.name ? (
                <>
                  <Text style={m.sectionTitle}>Listed By</Text>
                  <View style={m.ownerRow}>
                    <View style={m.ownerAvatar}><Text style={m.ownerInitial}>{project.owner.name.charAt(0).toUpperCase()}</Text></View>
                    <View>
                      <Text style={m.ownerName}>{project.owner.name}</Text>
                      <Text style={m.ownerRole}>{project.owner.companyName || project.owner.role}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={m.detailBox}>
      <View style={m.detailHead}>{icon}<Text style={m.detailLabel}>{label}</Text></View>
      <Text style={m.detailValue}>{value}</Text>
    </View>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: '#EAF8EE', borderTopLeftRadius: 26, borderTopRightRadius: 26, height: '90%', overflow: 'hidden' },
  scroll: { flex: 1 },
  topBar: { paddingTop: 10, paddingBottom: 4, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  closeBtn: { position: 'absolute', right: 14, top: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', height: 200 },
  noCover: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 18 },
  name: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  loc: { fontSize: 12, color: colors.muted2, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  badgeLive: { backgroundColor: colors.greenBg, borderColor: colors.greenBorder },
  badgeDraft: { backgroundColor: colors.cream, borderColor: colors.line },
  // Neutral status badge is now a warm beige pill (was the blue meaning chip).
  badgeNeutral: { backgroundColor: '#E7F0EA', borderColor: '#ECE5D8' },
  badgeRera: { backgroundColor: colors.brandTint, borderColor: `${colors.brand}33` },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  priceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E8D8', borderRadius: 20, padding: 16, marginTop: 16 },
  priceLabel: { fontSize: 9, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  priceValue: { fontSize: 21, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  priceValueSmall: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pricePerSqft: { marginLeft: 'auto', alignItems: 'flex-end' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 22, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailBox: { width: (SCREEN_W - 18 * 2 - 10) / 2, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3E8D8', padding: 12 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  detailLabel: { fontSize: 9, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  detailValue: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { backgroundColor: colors.brandTint, borderWidth: 1, borderColor: `${colors.brand}22`, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  amenityText: { fontSize: 11, fontWeight: '700', color: colors.brand },
  galleryImg: { width: 160, height: 110, borderRadius: 12, backgroundColor: colors.cream },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  ownerInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ownerName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  ownerRole: { fontSize: 11, color: colors.muted2, fontWeight: '600', marginTop: 1, textTransform: 'capitalize' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Green variant — Home / Properties page property details.
// Same Project data and same content as the default layout, restyled to the
// Home page's cream + dark-green theme: full-bleed hero with overlaid close +
// badges, a green price strip, icon fact row, overview grid, green amenity
// chips, gallery, listed-by card and a fixed Call / WhatsApp bar (shown only
// when the project actually has those CTA numbers).
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg: '#EAF8EE', card: '#FFFFFF', green: '#1F4D3A', greenSoft: '#E7F0EA',
  greenLine: '#C9DCCF', ink: '#1B2420', muted: '#7C847F', line: '#ECE5D8',
};

function isRent(p: Project): boolean {
  const t = [p.type, p.category, p.propertyType, p.projectStatus, p.name].filter(Boolean).join(' ').toLowerCase();
  return /\b(rent|rental|lease|leasing)\b/.test(t);
}

function digits(n?: string): string {
  return String(n || '').replace(/[^\d+]/g, '');
}

function GreenDetails({ visible = true, project, onClose, bottomInset, topInset = 0, action, loading = false }: {
  visible?: boolean; project: Project; onClose: () => void; bottomInset: number; topInset?: number; action?: DetailsAction; loading?: boolean;
}) {
  const cover = coverOf(project);
  const gallery = (project.galleryImages || []).map(urlOf).filter(Boolean) as string[];
  const images = [cover, ...gallery].filter(Boolean) as string[];
  const [heroIdx, setHeroIdx] = useState(0);
  const hero = images[heroIdx] || null;
  const rent = isRent(project);
  const area = cleanAreaText(project.carpetAreaRange) || cleanAreaText(project.plotSizeRange);
  const place = [project.location, project.city].filter(Boolean).join(', ');
  const call = digits(project.cta?.callNumber);
  const wa = digits(project.cta?.whatsappNumber);
  const hasCta = !!(call || wa);

  const facts = [
    project.bhkOptions?.length ? { icon: <BedDouble size={18} color={G.green} />, label: 'Config', value: project.bhkOptions.join(', ') } : null,
    area ? { icon: <Ruler size={18} color={G.green} />, label: 'Area', value: area } : null,
    { icon: <Building2 size={18} color={G.green} />, label: 'Type', value: propertyLabel(project) },
    { icon: <Layers size={18} color={G.green} />, label: 'Status', value: statusLabel(project.projectStatus) },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  const openMaps = () => {
    const url = project.googleMapLink
      || (project.latitude && project.longitude ? `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}` : '')
      || (place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${project.name} ${place}`)}` : '');
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <SlidePageModal visible={visible} transparent onRequestClose={onClose}>
      <View style={[g.overlay, { paddingTop: topInset }]}>
        <View style={g.sheet}>
          {/* Full-screen page: the ScrollView fills everything above the contact
              bar (flex: 1), so it always scrolls smoothly to the last row. */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            overScrollMode="always"
            decelerationRate="normal"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 36 }}
          >
            {/* Hero */}
            <View>
              {hero ? (
                <Image source={{ uri: hero }} style={g.hero} resizeMode="cover" />
              ) : (
                <PropertyCoverPlaceholder style={g.hero} seed={project.id || project.name} />
              )}
              <View style={g.grabber} />
              <Pressable onPress={onClose} hitSlop={10} style={g.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                <X size={20} color={G.ink} />
              </Pressable>
              <View style={g.heroBadges}>
                <View style={[g.pill, { backgroundColor: G.green }]}>
                  <Text style={[g.pillText, { color: '#fff' }]}>{rent ? 'For Rent' : 'For Sale'}</Text>
                </View>
                {project.reraApproved && (
                  <View style={[g.pill, { backgroundColor: '#FFFFFFEE' }]}>
                    <ShieldCheck size={12} color={G.green} />
                    <Text style={[g.pillText, { color: G.green }]}>RERA</Text>
                  </View>
                )}
              </View>
              {images.length > 1 && (
                <View style={g.counter}><Text style={g.counterText}>{heroIdx + 1}/{images.length}</Text></View>
              )}
            </View>

            {/* Thumbnails strip — tap to swap the hero image */}
            {images.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.thumbs}>
                {images.map((u, i) => (
                  <Pressable key={`${u}-${i}`} onPress={() => setHeroIdx(i)} accessibilityLabel={`Photo ${i + 1}`}>
                    <Image source={{ uri: u }} style={[g.thumb, i === heroIdx && g.thumbActive]} />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={g.pad}>
              <Text style={g.name}>{project.name}</Text>
              <Pressable style={g.locRow} onPress={openMaps} accessibilityRole="link" accessibilityLabel="Open location in maps">
                <MapPin size={15} color={G.green} />
                <Text style={g.loc} numberOfLines={2}>{place || 'Location on request'}</Text>
                <Navigation size={14} color={G.green} />
              </Pressable>

              {/* Price strip */}
              <View style={g.priceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={g.priceLabel}>{rent ? 'Rent' : 'Starting Price'}</Text>
                  <Text style={g.priceValue}>{fmtPrice(project.startingPrice)}{rent && project.startingPrice ? '/mo' : ''}</Text>
                  {!!project.totalPriceRange && <Text style={g.priceSub}>{project.totalPriceRange}</Text>}
                </View>
                {project.pricePerSqFt ? (
                  <View style={g.perSqft}>
                    <Text style={g.priceLabelLight}>Per sq ft</Text>
                    <Text style={g.perSqftValue}>₹{project.pricePerSqFt.toLocaleString('en-IN')}</Text>
                  </View>
                ) : null}
              </View>

              {/* Quick facts */}
              <View style={g.facts}>
                {facts.map((f) => (
                  <View key={f.label} style={g.fact}>
                    <View style={g.factIcon}>{f.icon}</View>
                    <Text style={g.factLabel}>{f.label}</Text>
                    <Text style={g.factValue} numberOfLines={2}>{f.value}</Text>
                  </View>
                ))}
              </View>

              {/* Overview */}
              <Text style={g.section}>Overview</Text>
              {loading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ActivityIndicator size="small" color={G.green} />
                  <Text style={{ fontSize: 12, color: G.muted }}>Loading full property details…</Text>
                </View>
              )}
              <View style={g.listCard}>
                <Row label="Listing For" value={rent ? 'Rent' : 'Sale'} />
                {!!(project.propertyType || project.category) && (
                  <Row label="Property Type" value={[project.category, project.propertyType].filter(Boolean).join(' · ')} />
                )}
                {!!place && <Row label="Address" value={place} />}
                {!!project.landmarks?.length && (
                  <Row label="Landmarks" value={project.landmarks.map(l => l?.name).filter(Boolean).join(', ')} />
                )}
                <Row label="Bank Loan" value={project.bankLoanAvailable ? 'Available' : 'Not available'} />
                {!!project.floorRange && <Row label="Floors" value={project.floorRange} />}
                {!!project.facingOptions?.length && <Row label="Facing" value={project.facingOptions.join(', ')} />}
                {project.gatedCommunity && <Row label="Community" value="Gated Community" />}
                {!!project.paymentPlan && <Row label="Payment Plan" value={project.paymentPlan} />}
                {!!project.reraNumber && <Row label="RERA No." value={project.reraNumber} />}
                <Row label="Listing" value={project.isPublished ? 'Published' : 'Draft'} last />
              </View>

              {/* Amenities */}
              {project.amenities?.length ? (
                <>
                  <Text style={g.section}>Amenities</Text>
                  <View style={g.chips}>
                    {project.amenities.map((a) => (
                      <View key={a} style={g.chip}>
                        <Check size={13} color={G.green} />
                        <Text style={g.chipText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {/* Listed by */}
              {project.owner?.name ? (
                <>
                  <Text style={g.section}>Listed By</Text>
                  <View style={g.owner}>
                    <View style={g.ownerAvatar}><Text style={g.ownerInitial}>{project.owner.name.charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={g.ownerName}>{project.owner.name}</Text>
                      <Text style={g.ownerRole}>{project.owner.companyName || project.owner.role}</Text>
                    </View>
                    {project.reraApproved && <CheckCircle size={18} color={G.green} />}
                  </View>
                </>
              ) : null}

            </View>
          </ScrollView>

          {/* Call · WhatsApp · Group Chat — one boxless bar pinned to the bottom:
              small logo + text, equal spacing (only actions that exist). */}
          {(hasCta || action) && (
            <View style={[g.contactBar, { paddingBottom: 10 + Math.max(bottomInset, 8) }]}>
              {!!call && (
                <Pressable style={g.contactItem} onPress={() => Linking.openURL(`tel:${call}`).catch(() => {})} hitSlop={10} accessibilityRole="button" accessibilityLabel="Call">
                  <Phone size={18} color={G.green} />
                  <Text style={g.contactText}>Call</Text>
                </Pressable>
              )}
              {!!wa && (
                <Pressable
                  style={g.contactItem}
                  onPress={() => Linking.openURL(`https://wa.me/${wa.replace(/^\+/, '')}?text=${encodeURIComponent(`Hi, I am interested in ${project.name}`)}`).catch(() => {})}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="WhatsApp"
                >
                  <MessageCircle size={18} color="#1F8A4C" />
                  <Text style={g.contactText}>WhatsApp</Text>
                </Pressable>
              )}
              {action && (
                <Pressable style={g.contactItem} onPress={action.onPress} disabled={action.loading} hitSlop={10} accessibilityRole="button" accessibilityLabel={action.label}>
                  {action.loading ? <ActivityIndicator size="small" color={G.green} /> : <Users size={18} color={G.green} />}
                  <Text style={g.contactText}>{action.kind === 'chat' ? 'Group Chat' : 'Join Group'}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </SlidePageModal>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[g.row, !last && g.rowLine]}>
      <Text style={g.rowLabel}>{label}</Text>
      <Text style={g.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const FACT_W = (SCREEN_W - 18 * 2 - 10) / 2;

const g = StyleSheet.create({
  // Full-screen page (was a 92% bottom sheet over a tappable backdrop, which
  // left the scroll height unreliable on Android and cut the last rows off).
  overlay: { flex: 1, backgroundColor: G.bg },
  sheet: { flex: 1, backgroundColor: G.bg },
  hero: { width: '100%', height: 260, backgroundColor: G.greenSoft },
  grabber: { position: 'absolute', top: 8, alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#FFFFFFCC' },
  closeBtn: { position: 'absolute', top: 16, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFFF2', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 },
  heroBadges: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 11 },
  pillText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  counter: { position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  thumbs: { gap: 8, paddingHorizontal: 18, paddingTop: 12 },
  thumb: { width: 62, height: 46, borderRadius: 10, backgroundColor: G.greenSoft, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: G.green },
  pad: { paddingHorizontal: 18, paddingTop: 16 },
  name: { fontSize: 25, fontWeight: '800', color: G.ink, letterSpacing: -0.3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  loc: { fontSize: 13, color: G.muted, fontWeight: '600', flexShrink: 1 },
  priceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.green, borderRadius: 20, padding: 16, marginTop: 16 },
  priceLabel: { fontSize: 10, fontWeight: '700', color: '#CFE3D6', letterSpacing: 0.6, textTransform: 'uppercase' },
  priceValue: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  priceSub: { fontSize: 11.5, color: '#CFE3D6', marginTop: 2 },
  perSqft: { alignItems: 'flex-end', paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: '#FFFFFF33' },
  priceLabelLight: { fontSize: 10, fontWeight: '700', color: '#CFE3D6', letterSpacing: 0.6, textTransform: 'uppercase' },
  perSqftValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  fact: { width: FACT_W, backgroundColor: G.card, borderRadius: 16, borderWidth: 1, borderColor: G.line, padding: 12 },
  factIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: G.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  factLabel: { fontSize: 10, fontWeight: '700', color: G.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  factValue: { fontSize: 13.5, fontWeight: '800', color: G.ink, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: G.ink, marginTop: 22, marginBottom: 10 },
  listCard: { backgroundColor: G.card, borderRadius: 16, borderWidth: 1, borderColor: G.line, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: G.line },
  rowLabel: { fontSize: 13, color: G.muted, fontWeight: '600' },
  rowValue: { fontSize: 13, color: G.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: G.greenSoft, borderWidth: 1, borderColor: G.greenLine, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  chipText: { fontSize: 12, fontWeight: '700', color: G.green },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: G.card, borderRadius: 16, borderWidth: 1, borderColor: G.line, padding: 12 },
  ownerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: G.green, alignItems: 'center', justifyContent: 'center' },
  ownerInitial: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ownerName: { fontSize: 14.5, fontWeight: '800', color: G.ink },
  ownerRole: { fontSize: 12, color: G.muted, fontWeight: '600', marginTop: 1, textTransform: 'capitalize' },
  // Boxless contact bar: items share the width equally (same spacing).
  contactBar: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingTop: 10, backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.line },
  contactItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  contactText: { fontSize: 12, fontWeight: '700', color: G.green },
  // End-of-page contact links: small green text, no box.
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: G.line },
  ctaLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  ctaLinkText: { fontSize: 13, fontWeight: '700', color: G.green },
});
