// The HomeInTown contact-card artwork, shared by the My Card preview /
// template thumbnails (VisitingCard) and the card posted into group chat
// (groupChat/SharedVisitingCard), so both always look the same.
//
// Drawn on a 320 x 162 canvas and scaled to `width`. Three looks:
//   classic : cream-mint, green border + waves, orange avatar, skyline
//   dark    : deep forest green, white type, orange accents
//   minimal : off-white, hairline border, soft orange accents, no skyline
// Display only: no buttons. Fields that are empty are simply not drawn.
import React, { forwardRef } from 'react';
import { View, Text, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Phone, Globe, MapPin, Home } from '../../icons';
import { isSafeHttpUrl } from '../../lib/safeUrl';
import type { CardTemplate } from '../../lib/api';

export const CARD_BASE_W = 320;
export const CARD_BASE_H = 162;

const ORANGE = '#F97316';

export interface HitCardArtProps {
  template: CardTemplate;
  name: string;
  designation?: string;
  company?: string;
  phone?: string;
  website?: string;
  address?: string;
  photoUrl?: string | null;
  /** Public card URL. The QR box is only drawn when this is set. */
  qrValue?: string;
  width: number;
}

interface Theme {
  bg: string; border: string; borderW: number;
  name: string; sub: string; company: string; text: string;
  rule: string; ring: string; ringBg: string; divider: string;
  iconBg: string; iconFg: string;
  logoMain: string; logoAccent: string;
  qrBorder: string;
  waves: Array<{ style: object; color: string; opacity?: number }>;
  skyline: string | null;
}

// Wave shapes are positioned in canvas units; scaled in the component.
const W_TOP_LIGHT = { left: -46, top: -62, width: 176, height: 108, radius: 62 };
const W_TOP_DARK = { left: -40, top: -68, width: 154, height: 98, radius: 62 };
const W_BOT_LIGHT = { left: -30, right: -30, bottom: -36, height: 60, radius: 120 };
const W_BOT_DARK = { left: -30, right: -8, bottom: -42, height: 56, radius: 120 };

const THEMES: Record<CardTemplate, Theme> = {
  classic: {
    bg: '#F3FBF5', border: '#2E8B4F', borderW: 1.5,
    name: '#14452F', sub: '#2E8B4F', company: '#14452F', text: '#1B3B2D',
    rule: 'rgba(31,77,58,0.16)', ring: '#9ED8AF', ringBg: '#D5F0DC', divider: '#1F4D3A',
    iconBg: '#14452F', iconFg: '#FFFFFF',
    logoMain: '#14452F', logoAccent: ORANGE,
    qrBorder: '#14452F',
    waves: [
      { style: W_TOP_LIGHT, color: '#58B574', opacity: 0.45 },
      { style: W_TOP_DARK, color: '#2E8B4F' },
      { style: W_BOT_LIGHT, color: '#58B574', opacity: 0.55 },
      { style: W_BOT_DARK, color: '#2E8B4F' },
    ],
    skyline: 'rgba(63,164,99,0.24)',
  },
  dark: {
    bg: '#0F3B28', border: '#1E6B47', borderW: 1,
    name: '#FFFFFF', sub: '#8FE0A8', company: '#FFFFFF', text: 'rgba(255,255,255,0.92)',
    rule: 'rgba(255,255,255,0.16)', ring: 'rgba(249,115,22,0.55)', ringBg: 'rgba(255,255,255,0.07)', divider: ORANGE,
    iconBg: ORANGE, iconFg: '#FFFFFF',
    logoMain: '#FFFFFF', logoAccent: ORANGE,
    qrBorder: ORANGE,
    waves: [
      { style: W_TOP_LIGHT, color: '#1E6B47', opacity: 0.7 },
      { style: W_TOP_DARK, color: '#0A2A1C' },
      { style: W_BOT_LIGHT, color: '#1E6B47', opacity: 0.6 },
      { style: W_BOT_DARK, color: '#0A2A1C' },
    ],
    skyline: 'rgba(255,255,255,0.08)',
  },
  minimal: {
    bg: '#FBF8F1', border: '#E7DFCC', borderW: 1,
    name: '#1F3D2E', sub: '#4F8A68', company: '#1F3D2E', text: '#2B3A32',
    rule: 'rgba(31,77,58,0.12)', ring: '#F6D9B8', ringBg: '#FFF1E2', divider: '#E7DFCC',
    iconBg: '#FFE9D2', iconFg: ORANGE,
    logoMain: '#1F3D2E', logoAccent: ORANGE,
    qrBorder: '#1F3D2E',
    waves: [
      { style: { left: -40, top: -66, width: 130, height: 90, radius: 60 }, color: '#F9B37A', opacity: 0.35 },
      { style: { left: -20, right: -20, bottom: -30, height: 40, radius: 120 }, color: '#F9B37A', opacity: 0.45 },
      { style: { left: -20, right: -20, bottom: -34, height: 34, radius: 120 }, color: ORANGE, opacity: 0.85 },
    ],
    skyline: null,
  },
};

// Faint skyline behind the lower right: [left, width, height].
const SKYLINE: Array<[number, number, number]> = [
  [118, 14, 30], [134, 13, 44], [149, 16, 34], [167, 13, 56], [182, 15, 38], [199, 11, 26], [212, 15, 40], [229, 12, 24],
];

const HitCardArt = forwardRef<View, HitCardArtProps>(function HitCardArt(props, ref) {
  const { template, name, designation, company, phone, website, address, photoUrl, qrValue, width } = props;
  const t = THEMES[template] || THEMES.classic;
  const k = width / CARD_BASE_W;
  const z = (n: number) => Math.round(n * k * 10) / 10;
  const photo = photoUrl && isSafeHttpUrl(photoUrl) ? photoUrl : null;
  const shownName = (name || '').trim() || 'Your Name';
  const initial = shownName.charAt(0).toUpperCase();

  const rows: Array<{ Icon: typeof Phone; value: string; lines: number }> = [
    { Icon: Phone, value: (phone || '').trim(), lines: 1 },
    { Icon: Globe, value: (website || '').trim(), lines: 1 },
    { Icon: MapPin, value: (address || '').trim(), lines: 2 },
  ].filter((r) => r.value);

  return (
    // collapsable={false}: without it Android may flatten this View away and
    // captureRef (Share PNG) finds no native view to snapshot.
    <View
      ref={ref}
      collapsable={false}
      style={{
        width, height: z(CARD_BASE_H), borderRadius: z(16), overflow: 'hidden',
        backgroundColor: t.bg, borderColor: t.border, borderWidth: Math.max(1, z(t.borderW)),
      }}
    >
      {/* Waves */}
      {t.waves.map((w, i) => {
        const st: any = w.style;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: st.left !== undefined ? z(st.left) : undefined,
              right: st.right !== undefined ? z(st.right) : undefined,
              top: st.top !== undefined ? z(st.top) : undefined,
              bottom: st.bottom !== undefined ? z(st.bottom) : undefined,
              width: st.width !== undefined ? z(st.width) : undefined,
              height: z(st.height),
              borderRadius: z(st.radius),
              backgroundColor: w.color,
              opacity: w.opacity ?? 1,
            }}
          />
        );
      })}

      {/* Skyline */}
      {t.skyline && SKYLINE.map(([l, bw, bh], i) => (
        <View
          key={i}
          style={{
            position: 'absolute', left: z(l), bottom: z(12), width: z(bw), height: z(bh),
            backgroundColor: t.skyline as string, borderTopLeftRadius: z(2), borderTopRightRadius: z(2),
          }}
        />
      ))}

      {/* Logo, top right */}
      <View style={{ position: 'absolute', right: z(14), top: z(9), flexDirection: 'row', alignItems: 'center', gap: z(3) }}>
        <Home size={z(15)} color={t.logoAccent} strokeWidth={2.4} />
        <Text style={{ fontSize: z(13), fontWeight: '800', color: t.logoMain }}>
          HomeIn<Text style={{ color: t.logoAccent }}>Town</Text>
        </Text>
      </View>

      {/* Avatar */}
      <View
        style={{
          position: 'absolute', left: z(14), top: z(18), width: z(64), height: z(64), borderRadius: z(32),
          alignItems: 'center', justifyContent: 'center', backgroundColor: t.ringBg,
          borderWidth: Math.max(1, z(1.5)), borderColor: t.ring,
        }}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: z(54), height: z(54), borderRadius: z(27) }} />
        ) : (
          <View style={{ width: z(54), height: z(54), borderRadius: z(27), backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: z(26), fontWeight: '800' }}>{initial}</Text>
          </View>
        )}
      </View>

      {/* Divider + name block */}
      <View style={{ position: 'absolute', left: z(88), top: z(24), width: Math.max(1, z(1.5)), height: z(50), backgroundColor: t.divider }} />
      <View style={{ position: 'absolute', left: z(97), top: z(20), right: z(92) }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: z(20), fontWeight: '800', color: t.name }}>
          {shownName}
        </Text>
        {!!designation && (
          <Text numberOfLines={1} style={{ fontSize: z(12.5), fontWeight: '600', color: t.sub, marginTop: z(1) }}>{designation}</Text>
        )}
        {!!company && (
          <Text numberOfLines={1} style={{ fontSize: z(12), fontWeight: '800', color: t.company, marginTop: z(1) }}>{company}</Text>
        )}
      </View>

      {/* Thin rule */}
      <View style={{ position: 'absolute', left: z(14), right: z(100), top: z(88), height: 1, backgroundColor: t.rule }} />

      {/* Contact rows */}
      <View style={{ position: 'absolute', left: z(14), top: z(94), right: z(100), gap: z(4) }}>
        {rows.map(({ Icon, value, lines }) => (
          <View key={value} style={{ flexDirection: 'row', alignItems: lines > 1 ? 'flex-start' : 'center', gap: z(7) }}>
            <View style={{ width: z(16), height: z(16), borderRadius: z(8), backgroundColor: t.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={z(9)} color={t.iconFg} strokeWidth={2.6} />
            </View>
            <Text numberOfLines={lines} style={{ flex: 1, fontSize: z(11), fontWeight: '500', color: t.text, lineHeight: z(13) }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* QR */}
      {!!qrValue && (
        <View
          style={{
            position: 'absolute', right: z(12), top: z(40), width: z(74), height: z(74), borderRadius: z(10),
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
            borderWidth: Math.max(1, z(2)), borderColor: t.qrBorder,
          }}
        >
          <QRCode value={qrValue} size={Math.max(20, z(60))} color="#14452F" backgroundColor="#FFFFFF" quietZone={0} />
        </View>
      )}
    </View>
  );
});

export default HitCardArt;
