/**
 * PhotoCard — property card laid out like the Godrej reference screenshot.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ ┌────────┐  Name                              │
 *   │ │ For    │  📍 Location                       │
 *   │ │ Sale   │  [BHK] [Area] [Type]               │
 *   │ │ photo  │  ₹85L | ₹13,077/sq.ft              │
 *   │ │        │  [Status] [View Project] [Chat]    │
 *   │ └────────┘                                    │
 *   └───────────────────────────────────────────────┘
 *
 * The photo is inset (rounded, with padding around it) and stretches to the
 * height of the info column, so it always lines up with the text. All three
 * bottom pills sit in the info column, to the right of the photo.
 * Green theme (app brand #1F4D3A) instead of the reference's orange.
 */

import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MapPin, Eye, MessageCircle, BedDouble, Ruler, Home as HomeIcon, BadgeCheck } from '../icons';
import PropertyCoverPlaceholder from './PropertyCoverPlaceholder';

export const CARD_GREEN = '#1F4D3A';

const G = {
  bg: '#FFFFFF',
  border: 'rgba(31,77,58,0.10)',
  name: '#17233A',
  loc: '#4B5A66',
  chip: '#E7F0EA',
  chipText: '#1A3B2E',
  price: '#17233A',
  priceSep: '#C8DDD2',
  priceSub: '#5A6672',
  pillBorder: '#CFE0D6',
  pillBg: '#FFFFFF',
  pillText: '#17233A',
  chatBg: '#F1F8F4',
};

export default function PhotoCard({
  image, seed, price, chips = [], title, location,
  onPress, onViewProperty, onChat,
  style, accessibilityLabel, footer,
  status, pricePerSqft, listingLabel,
  // Accepted for compatibility with existing callers; not drawn on this card.
  actions, broker, tag: _tag, imageHeight: _imageHeight,
}: {
  footer?: React.ReactNode;
  image?: string | null;
  seed?: string;
  tag?: string;
  price?: string;
  pricePerSqft?: string;
  /** e.g. "Under Construction" / "Ready to Move" */
  status?: string;
  /** "For Sale" / "For Rent" badge on the photo */
  listingLabel?: string;
  broker?: string;
  /** [BHK, area, type] — each optional */
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
  // Positional: [BHK, area, type]. A missing one stays missing (it must not slide
  // into the next chip's slot and pick up the wrong icon).
  const [bhk = '', area = '', type = ''] = chips;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.97, transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {/* Share / 3-dot (Projects + Marketplace only): top-right corner of the card. */}
      {!!actions && <View style={s.corner}>{actions}</View>}
      <View style={s.row}>
        {/* Photo: inset, rounded, stretches to the info column's height */}
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

        {/* Info */}
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={[s.name, { flexShrink: 1 }, !!actions && s.nameWithActions]} numberOfLines={1}>{title}</Text>
            {!!broker && (
              <View style={s.broker}>
                <Text style={s.brokerTxt}>{broker}</Text>
                <BadgeCheck size={14} color={CARD_GREEN} />
              </View>
            )}
          </View>

          {(!!location || !!status) && (
            <View style={s.locRow}>
              <MapPin size={14} color={CARD_GREEN} fill={CARD_GREEN} />
              <Text style={s.loc} numberOfLines={2}>
                {location}
                {!!status && <Text style={s.statusInline}>{location ? '  ·  ' : ''}{status}</Text>}
              </Text>
            </View>
          )}

          {(!!bhk || !!area || !!type) && (
            <View style={s.chips}>
              {!!bhk && (
                <View style={s.chip}>
                  <BedDouble size={11} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{bhk}</Text>
                </View>
              )}
              {!!area && (
                <View style={s.chip}>
                  <Ruler size={11} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{area}</Text>
                </View>
              )}
              {!!type && (
                <View style={s.chip}>
                  <HomeIcon size={11} color={CARD_GREEN} />
                  <Text style={s.chipTxt} numberOfLines={1}>{type}</Text>
                </View>
              )}
            </View>
          )}

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

          {footer}

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
                  <Eye size={13} color={CARD_GREEN} />
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
                  <MessageCircle size={13} color={CARD_GREEN} />
                  <Text style={[s.pillTxt, { color: CARD_GREEN }]} numberOfLines={1}>Chat</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: G.border,
    padding: 10,
    shadowColor: CARD_GREEN,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  // ~32% of the card width, as tall as the info column.
  photoBox: {
    width: '32%',
    minHeight: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: G.chip,
  },
  badge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: CARD_GREEN,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 14,
  },
  badgeTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  info: { flex: 1, minWidth: 0, gap: 5, justifyContent: 'flex-start' },
  name: { fontSize: 18, fontWeight: '800', color: G.name, lineHeight: 23 },
  nameWithActions: { paddingRight: 84 },
  // Title on the left; broker (full name + green tick) in the top-right corner.
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  broker: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '58%', flexShrink: 0, paddingTop: 2 },
  brokerTxt: { flexShrink: 1, fontSize: 11.5, fontWeight: '700', color: CARD_GREEN, textAlign: 'right' },
  corner: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 5 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loc: { flex: 1, fontSize: 12, color: G.loc, fontWeight: '500', lineHeight: 16 },
  statusInline: { fontSize: 12, color: CARD_GREEN, fontWeight: '700' },
  // Chips share one line when they fit and wrap only on very narrow screens.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: G.chip, borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 4, maxWidth: '100%',
  },
  chipTxt: { fontSize: 10, fontWeight: '600', color: G.chipText, flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  price: { fontSize: 22, fontWeight: '900', color: G.price },
  priceSep: { width: 1.5, height: 18, backgroundColor: G.priceSep, marginHorizontal: 8 },
  priceSub: { flexShrink: 1, fontSize: 11.5, color: G.priceSub, fontWeight: '500' },
  // All three pills on one line, to the right of the photo.
  // marginTop:auto pushes the row to the bottom of the info column; flex-end puts
  // View Project then Chat in the bottom-right corner.
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 'auto', paddingTop: 2 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1,
    borderColor: CARD_GREEN, backgroundColor: G.chatBg,
  },
  chatPill: { borderColor: CARD_GREEN, backgroundColor: G.chatBg },
  pillTxt: { fontSize: 10.5, fontWeight: '700', color: CARD_GREEN },
  iconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
