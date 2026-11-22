// Local placeholder AVATAR for builders / companies / posters that have no real
// profile image. Draws a monogram (first letters of the name) on a warm gradient
// disc with a faint building glyph — a "logo-like" fallback that is clearly a
// placeholder yet looks intentional, in the app's orange theme.
//
// Used ONLY where a real image is absent (requirement 3 + 6): callers keep
// rendering the real <Image> when the API provides one and fall back to this.

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';
import { seedIndex } from './seed';

// A few warm gradient pairs so different builders get different disc colours.
const GRADIENTS: Array<[string, string]> = [
  ['#2F6B52', '#1F4D3A'],
  ['#3A7A5E', '#173D2E'],
  ['#41806A', '#1F4D3A'],
  ['#3A7A5E', '#173D2E'],
  ['#41806A', '#245641'],
];

// Green palette for the green-themed screens (My Group list).
const GREEN_GRADIENTS: Array<[string, string]> = [
  ['#2F6B52', '#1F4D3A'],
  ['#3A7A5E', '#245641'],
  ['#2B5F49', '#173D2E'],
  ['#41806A', '#28604A'],
  ['#336E57', '#1C4535'],
];

function initials(name?: string): string {
  const n = (name || '').trim();
  if (!n) return '🏢';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function BuilderAvatar({
  name,
  seed,
  size = 54,
  style,
  palette = 'warm',
}: {
  name?: string;
  seed?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  palette?: 'warm' | 'green';
}) {
  const set = palette === 'green' ? GREEN_GRADIENTS : GRADIENTS;
  const v = seedIndex(seed || name, set.length);
  const [c0, c1] = set[v];
  const gid = `ba${palette}${v}`;
  const label = initials(name);
  const fontSize = Math.round(size * 0.38);

  return (
    <View style={[{ width: size, height: size }, s.wrap, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c0} />
            <Stop offset="1" stopColor={c1} />
          </LinearGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${gid})`} />
        {/* faint building glyph behind the monogram */}
        <Path
          d="M30 74 V46 H48 V74 M52 74 V36 H70 V74 M34 52 H40 M34 60 H40 M56 44 H62 M56 52 H62 M56 60 H62"
          stroke="#FFFFFF"
          strokeOpacity={0.18}
          strokeWidth={3}
          fill="none"
        />
      </Svg>
      <Text style={[s.label, { fontSize }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
