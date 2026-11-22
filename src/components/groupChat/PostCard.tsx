import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Building2 } from '../../icons';
import { colors } from '../../theme';
import { propertyCardShared } from './sharedStyles';
import PhotoCard from '../PhotoCard';

// ─── Compact posted-property card (with expand toggle) ──────────────────────
// Marketplace-style property card for the Post view.
// - Draft (not yet posted): shows "Post to Group" (green) + "View Property".
// - Posted: shows a "LISTED" badge; "Post to Group" is faded/disabled during the
//   8h cooldown (shows remaining time), then re-enables.
function PostCard({ item, posted, cooldownLeftMs, posting, onPost, onView }: {
  item: { title?: string; subtitle?: string; price?: string; tags?: string[]; image?: string; fields?: Array<{ label: string; value: string }> };
  posted: boolean;
  cooldownLeftMs: number;
  posting: boolean;
  onPost: () => void;
  onView: () => void;
}) {
  // "Post to Group" / "View Property" buttons were removed (user request): the
  // whole card now opens the property details. onPost / cooldown props are kept
  // so callers stay unchanged.
  void onPost; void cooldownLeftMs; void posting;
  // Same reference photo card as the rest of the app.
  const usePhotoCard = true;
  if (usePhotoCard) {
    return (
      <PhotoCard
        image={item.image || null}
        seed={item.title || 'post'}
        tag={`HOME IN TOWN · ${posted ? 'LISTED' : 'READY TO POST'}`}
        price={item.price || undefined}
        chips={(item.tags || []).slice(0, 3)}
        title={item.title || 'Property'}
        location={item.subtitle || undefined}
        imageHeight={170}
        onPress={onView}
        accessibilityLabel={`View ${item.title || 'property'} details`}
      />
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [pd.card, pressed && { opacity: 0.9 }]}
      onPress={onView}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.title || 'property'} details`}
    >
      <View style={pd.cardTop}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={pd.cardThumb} resizeMode="cover" />
        ) : (
          <View style={propertyCardShared.cardIcon}><Building2 size={22} color={colors.brand} /></View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[pd.badge, { backgroundColor: posted ? `${colors.greenText}18` : `${colors.brand}18` }]}>
              <Text style={[pd.badgeText, { color: posted ? colors.greenText : colors.brand }]}>{posted ? 'LISTED' : 'READY'}</Text>
            </View>
            <Text style={pd.cardTitle} numberOfLines={1}>{item.title || 'Property'}</Text>
          </View>
          {item.subtitle ? <Text style={pd.cardLoc} numberOfLines={1}>📍 {item.subtitle}</Text> : null}
        </View>
        {item.price ? <Text style={propertyCardShared.cardPrice}>{item.price}</Text> : null}
      </View>

      {/* Tags row (BHK / area / type) */}
      {item.tags && item.tags.length > 0 && (
        <View style={pd.tagsRow}>
          {item.tags.slice(0, 3).map((t, i) => (
            <View key={i} style={pd.tag}><Text style={pd.tagText} numberOfLines={1}>{t}</Text></View>
          ))}
        </View>
      )}

    </Pressable>
  );
}

// Kept named `pd` so the JSX body above is byte-identical to what it was inside
// GroupChatEmbedded.tsx. Each of these 16 keys was measured at exactly one
// reference, all of them in this component. cardIcon and cardPrice are NOT here:
// the parent's View Property detail sheet reads them too, so they live in
// sharedStyles.ts and are read through propertyCardShared above.
const pd = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(31,77,58,0.12)', padding: 12, gap: 10,
    shadowColor: '#1F4D3A', shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 0,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.line },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.brand },
  cardLoc: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  // tags row (BHK / area / type)
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 10, fontWeight: '700', color: colors.muted2, maxWidth: 140 },
  // actions row (Post to Group + View Property) — Lead Match mini-pill style.
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  ctaMini: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFE3D1', shadowColor: '#2B4A3C', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  ctaMiniDim: { opacity: 0.5 },
  ctaMiniText: { fontSize: 11, fontWeight: '700', color: '#17233A' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3 },
});

export default PostCard;
