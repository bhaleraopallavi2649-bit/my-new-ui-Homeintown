// Visiting card renderer used by the My Card screen: the large live preview,
// the three template thumbnails, and the View that shareCardPng() captures.
//
// Sizes are designed at 320 px wide and scaled by `width / 320`, so the same
// layout works as a ~100 px thumbnail. Below COMPACT_W the contact rows, RERA
// line and QR are dropped because they would be unreadable smudges.
import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Phone, Mail, Globe, MapPin, BadgeCheck } from '../../icons';
import { colors, radius } from '../../theme';
import { isSafeHttpUrl } from '../../lib/safeUrl';
import type { CardTemplate, VisitingCardData } from '../../lib/api';

export const CARD_TEMPLATES: { key: CardTemplate; label: 'Classic' | 'Dark' | 'Minimal' }[] = [
  { key: 'classic', label: 'Classic' },
  { key: 'dark', label: 'Dark' },
  { key: 'minimal', label: 'Minimal' },
];

const BASE_W = 320;
const COMPACT_W = 200;

interface Props {
  card: VisitingCardData;
  template: CardTemplate;
  /** Public card URL. The QR is only drawn when this is set (i.e. published). */
  qrValue?: string;
  width?: number;
}

interface Palette { bg: string; border: string; name: string; sub: string; text: string; icon: string; accent: string; divider: string }

const PALETTES: Record<CardTemplate, Palette> = {
  classic: { bg: colors.white, border: colors.line, name: colors.ink, sub: colors.muted2, text: colors.ink, icon: colors.brand, accent: colors.brand, divider: colors.line },
  dark: { bg: colors.night, border: colors.night2, name: colors.white, sub: 'rgba(255,255,255,0.65)', text: colors.white, icon: colors.brand, accent: colors.brand, divider: 'rgba(255,255,255,0.15)' },
  minimal: { bg: colors.white, border: colors.line, name: colors.ink, sub: colors.muted2, text: colors.ink, icon: colors.muted2, accent: colors.ink, divider: colors.line },
};

const clean = (v: string | null | undefined) => String(v ?? '').trim();

const VisitingCard = forwardRef<View, Props>(function VisitingCard({ card, template, qrValue, width = BASE_W }, ref) {
  const k = width / BASE_W;
  const z = (n: number) => Math.max(1, Math.round(n * k * 10) / 10);
  const p = PALETTES[template] || PALETTES.classic;
  const compact = width < COMPACT_W;
  const centered = template === 'minimal';

  const name = clean(card.name) || 'Your Name';
  const designation = clean(card.designation);
  const company = clean(card.companyName);
  const a = card.address || ({} as VisitingCardData['address']);
  const address = [a.line, a.city, a.state, a.pinCode].map(clean).filter(Boolean).join(', ');
  const imgUrl = [card.logoUrl, card.photoUrl].find((u) => isSafeHttpUrl(u));

  const rows: { Icon: typeof Phone; value: string }[] = [
    { Icon: Phone, value: clean(card.phone) },
    { Icon: Mail, value: clean(card.email) },
    { Icon: Globe, value: clean(card.website) },
    { Icon: MapPin, value: address },
  ].filter((r) => r.value);

  const avatarSize = z(44);
  const avatar = imgUrl ? (
    <Image source={{ uri: imgUrl }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} />
  ) : (
    <View style={[s.initial, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: p.accent }]}>
      <Text style={[s.initialText, { fontSize: z(18), color: colors.white }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  return (
    // collapsable={false}: without it Android may flatten this View away and
    // captureRef (Share PNG) finds no native view to snapshot.
    <View
      ref={ref}
      collapsable={false}
      style={[
        s.root,
        {
          width,
          minHeight: width / 1.75,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderRadius: z(radius.lg),
        },
      ]}
    >
      {template === 'classic' && <View style={[s.accentBar, { width: z(6), backgroundColor: p.accent }]} />}
      {template === 'dark' && <View style={[s.topLine, { height: z(4), backgroundColor: p.accent }]} />}

      <View style={{ padding: z(16), paddingLeft: template === 'classic' ? z(22) : z(16), flex: 1 }}>
        <View style={[centered ? s.headCentered : s.head, { gap: z(10) }]}>
          {avatar}
          <View style={centered ? { alignItems: 'center' } : { flex: 1 }}>
            <View style={[s.nameRow, { gap: z(4) }]}>
              <Text style={[s.name, { fontSize: z(17), color: p.name }]} numberOfLines={1}>{name}</Text>
              {card.verified && <BadgeCheck size={z(15)} color={colors.green} />}
            </View>
            {!!designation && (
              <Text style={[s.sub, { fontSize: z(11), color: p.sub }]} numberOfLines={1}>{designation}</Text>
            )}
            {!!company && (
              <Text style={[s.company, { fontSize: z(12), color: template === 'dark' ? p.accent : p.text }]} numberOfLines={1}>
                {company}
              </Text>
            )}
          </View>
        </View>

        {!compact && (
          <>
            <View style={[s.divider, { marginVertical: z(10), backgroundColor: p.divider }]} />
            <View style={[s.bottom, centered && s.bottomCentered, { gap: z(10) }]}>
              <View style={[centered ? { alignItems: 'center' } : { flex: 1 }, { gap: z(5) }]}>
                {rows.map(({ Icon, value }) => (
                  <View key={value} style={[s.row, { gap: z(6) }]}>
                    <Icon size={z(12)} color={p.icon} />
                    <Text style={[s.rowText, { fontSize: z(11), color: p.text }]} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
                {!!clean(card.reraAgentNo) && (
                  <Text style={[s.rera, { fontSize: z(10), color: p.sub }]} numberOfLines={1}>
                    RERA Agent No: {clean(card.reraAgentNo)}
                  </Text>
                )}
              </View>
              {!!qrValue && (
                // White quiet zone so the QR scans on the dark template too.
                <View style={[s.qrBox, { padding: z(4), borderRadius: z(6) }]}>
                  <QRCode value={qrValue} size={z(72)} />
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
});

export default VisitingCard;

const s = StyleSheet.create({
  root: { borderWidth: 1, overflow: 'hidden', position: 'relative' },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  topLine: { position: 'absolute', left: 0, right: 0, top: 0 },
  head: { flexDirection: 'row', alignItems: 'center' },
  headCentered: { alignItems: 'center' },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontWeight: '800', flexShrink: 1 },
  sub: { fontWeight: '600', marginTop: 1 },
  company: { fontWeight: '700', marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end' },
  bottomCentered: { flexDirection: 'column', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flexShrink: 1 },
  rera: { fontWeight: '600', marginTop: 2 },
  qrBox: { backgroundColor: colors.white },
});
