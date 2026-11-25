/**
 * PhotoCard — property card (reference screenshot "Godrej" layout).
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ ┌────────┐  Title (Flat / Project Name)       │
 *   │ │For Sale│  Broker name + ✓                   │
 *   │ │ photo  │  📍 Location pill                  │
 *   │ │        │  [BHK chip] [Area chip] [Type chip] │
 *   │ └────────┘  ₹85L  ·  ₹13k/sq.ft              │
 *   │             Status · View Project             │
 *   │  ─────────────────────────────────────────── │
 *   │  Listing For: Sale · Type: flat · …           │
 *   └───────────────────────────────────────────────┘
 *
 * Photo is compact (~28% wide) so text has more room.
 * Green theme (app brand #1F4D3A).
 */

import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MapPin, Eye, MessageCircle, BedDouble, Ruler, Home as HomeIcon, BadgeCheck } from '../icons';
import PropertyCoverPlaceholder from './PropertyCoverPlaceholder';

export const CARD_GREEN = '#1F4D3A';

const G = {
  bg: '#FFFFFF',
  border: 'rgba(31,77,58,0.12)',
  name: '#17233A',
  loc: '#1F4D3A',
  chip: '#E7F0EA',
  chipText: '#1A3B2E',
  price: '#17233A',
  priceSep: '#C8DDD2',
  priceSub: '#5A6672',
  pillBorder: '#CFE0D6',
  pillBg: '#FFFFFF',
  pillText: '#17233A',
  chatBg: '#F1F8F4',
  locPill: '#E7F0EA',
  locPillText: '#1F4D3A',
  metaBg: '#F3FBF5',
  metaBorder: 'rgba(31,77,58,0.12)',
};

export default function PhotoCard({
  image, seed, price, chips = [], title, location,
  onPress, onViewProperty, onChat,
  style, accessibilityLabel, footer,
  status, pricePerSqft, listingLabel,
  actions, broker,
  tag: _tag, imageHeight: _imageHeight,
}: {
  footer?: React.ReactNode;
  image?: string | null;
  seed?: string;
  tag?: string;
  price?: string;
  pricePerSqft?: string;
  status?: string;
  listingLabel?: string;
  broker?: string;
  chips?: string[];
  title: string;
  location?: string;
  actions?: React.ReactNode;
  onPress?: () => void;
  onViewProperty?: () => void;
  onChat?: () => void;
  imageHeight?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const [bhk = '', area = '', type = ''] = chips;

  // Metadata row text assembled from footer or the structured fields.
  // Metadata row removed — this is a UI-only text that clutters the card.
  const metaText = '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.97, transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {!!actions && <View style={s.corner}>{actions}</View>}

      {/* ── Top row: compact photo + info column ── */}
      <View style={s.row}>
        {/* Photo: compact 26% so info has more room */}
        <View style={s.photoBox}>
          {image
            ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <PropertyCoverPlaceholder seed={seed || title} style={StyleSheet.absoluteFill} />}
          {!!listingLabel && (
            <View style={s.badge}>
              <Text style={s.badgeTxt} numberOfLines={1}>{listingLabel}</Text>
            </View>
          )}
        </View>

        {/* Info column */}
        <View style={s.info}>
          {/* Title + broker */}
          <View style={s.nameRow}>
            <Text
              style={[s.name, { flexShrink: 1 }, !!actions && s.nameWithActions]}
              numberOfLines={1}
            >{title}</Text>
            {!!broker && (
              <View style={s.broker}>
                <Text style={s.brokerTxt} numberOfLines={1}>{broker}</Text>
                <BadgeCheck size={13} color="#2563EB" />
              </View>
            )}
          </View>

          {/* Location — plain text, no pill box */}
          {!!location && (
            <View style={s.locRow}>
              <MapPin size={12} color={CARD_GREEN} />
              <Text style={s.loc} numberOfLines={1}>{location}</Text>
            </View>
          )}

          {/* Type / BHK / Area chips */}
          {(!!bhk || !!area || !!type) && (
            <View style={s.chips}>
              {!!type && (
                <View style={s.chip}>
                  <HomeIcon size={10} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{type}</Text>
                </View>
              )}
              {!!status && (
                <View style={[s.chip, s.statusChip]}>
                  <Text style={s.statusChipTxt} numberOfLines={1}>{status}</Text>
                </View>
              )}
              {!!bhk && (
                <View style={s.chip}>
                  <BedDouble size={10} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{bhk}</Text>
                </View>
              )}
              {!!area && (
                <View style={s.chip}>
                  <Ruler size={10} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{area}</Text>
                </View>
              )}
            </View>
          )}

          {/* Price */}
          {!!price && (
            <View style={s.priceRow}>
              <Text style={s.price} numberOfLines={1}>{price}</Text>
              {!!pricePerSqft && (
                <>
                  <View style={s.priceSep} />
                  <Text style={s.priceSub} numberOfLines={1}>{pricePerSqft}</Text>
                </>
              )}
            </View>
          )}

          {/* Footer (extras from MessageBubble) */}
          {footer}

          {/* View Project pill */}
          {(!!onViewProperty || !!onChat) && (
            <View style={s.actions}>
              {!!onViewProperty && (
                <Pressable
                  onPress={e => { e.stopPropagation?.(); onViewProperty(); }}
                  style={({ pressed }) => [s.pill, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="View Project"
                >
                  <Eye size={12} color={CARD_GREEN} />
                  <Text style={s.pillTxt} numberOfLines={1}>View Project</Text>
                </Pressable>
              )}
              {!!onChat && (
                <Pressable
                  onPress={e => { e.stopPropagation?.(); onChat(); }}
                  style={({ pressed }) => [s.pill, s.chatPill, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Chat"
                >
                  <MessageCircle size={12} color={CARD_GREEN} />
                  <Text style={[s.pillTxt, { color: CARD_GREEN }]} numberOfLines={1}>Chat</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ── Metadata row: spans full card width below the photo+info ── */}
      {!!metaText && (
        <View style={s.metaBox}>
          <Text style={s.metaTxt} numberOfLines={2}>{metaText}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PhotoCardIcon({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.iconBtn} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: G.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: G.border,
    padding: 10,
    gap: 8,
    shadowColor: CARD_GREEN,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  // Compact photo: 26% wide, min 90 dp tall.
  photoBox: {
    width: '26%',
    minHeight: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: G.chip,
    flexShrink: 0,
  },
  badge: {
    position: 'absolute', top: 7, left: 6,
    backgroundColor: CARD_GREEN,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  badgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  info: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'flex-start' },
  name: { fontSize: 16, fontWeight: '800', color: G.name, lineHeight: 21 },
  nameWithActions: { paddingRight: 84 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 },
  broker: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '56%', flexShrink: 0, paddingTop: 2 },
  brokerTxt: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: CARD_GREEN, textAlign: 'right' },
  corner: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 5 },
  // Location as a soft green pill
  locPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: G.locPill, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  locPillTxt: { flex: 1, fontSize: 11, fontWeight: '600', color: G.locPillText },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loc: { flex: 1, fontSize: 12, color: G.loc, fontWeight: '500', lineHeight: 16 },
  statusInline: { fontSize: 12, color: CARD_GREEN, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: G.chip, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 3, maxWidth: '100%',
  },
  // Status badge in a slightly different tint so it stands apart from BHK/area
  statusChip: {
    backgroundColor: '#D1FAE5', borderWidth: 0,
  },
  statusChipTxt: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  chipTxt: { fontSize: 10, fontWeight: '600', color: G.chipText, flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  price: { fontSize: 20, fontWeight: '900', color: G.price },
  priceSep: { width: 1.5, height: 16, backgroundColor: G.priceSep, marginHorizontal: 7 },
  priceSub: { flexShrink: 1, fontSize: 11, color: G.priceSub, fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 14, borderWidth: 1,
    borderColor: CARD_GREEN, backgroundColor: G.chatBg,
  },
  chatPill: { borderColor: CARD_GREEN, backgroundColor: G.chatBg },
  pillTxt: { fontSize: 10, fontWeight: '700', color: CARD_GREEN },
  iconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  // Full-width metadata row below the photo+info block
  metaBox: {
    backgroundColor: G.metaBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G.metaBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  metaTxt: { fontSize: 11, color: '#1F4D3A', lineHeight: 16 },
});
