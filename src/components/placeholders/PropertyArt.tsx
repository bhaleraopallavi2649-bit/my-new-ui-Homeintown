// Local, license-free property placeholder ART for listings that have no real
// cover image. The user asked for "suitable dummy property images instead of
// generic building icons"; downloading photo stock risks licensing + build
// fragility, so these are self-contained react-native-svg illustrations drawn in
// the app's warm orange/cream palette. They look like property scenes (sky, sun,
// buildings, trees) and vary by a seed so two cards rarely show the same art.
//
// IMPORTANT: this ONLY ever replaces the no-cover fallback. A listing with a
// real API cover still renders its <Image> — this art is never drawn over real
// data (requirement 6).

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, G } from 'react-native-svg';
import { seedIndex } from './seed';

// Warm palette tuned to the app theme (brand orange / cream), kept local so the
// art reads as "ours" without importing render-time theme tokens into SVG.
const SKY = ['#E7F0EA', '#DCEADF', '#E7F0EA', '#E7F0EA'];
const BUILDING = ['#1F4D3A', '#245641', '#3A7A5E', '#173D2E'];
const BUILDING_DK = ['#173D2E', '#1F4D3A', '#2F6B52', '#173D2E'];
const WINDOW = '#FFF7EC';

// Four distinct skyline compositions, all on a 100×100 viewBox so they scale to
// any slot. Each returns the <G> of buildings for the chosen variant.
function Skyline({ v }: { v: number }) {
  const b = BUILDING[v % BUILDING.length];
  const d = BUILDING_DK[v % BUILDING_DK.length];
  const win = (x: number, y: number, w = 4, h = 5) => (
    <Rect x={x} y={y} width={w} height={h} rx={0.8} fill={WINDOW} opacity={0.9} />
  );

  if (v === 0) {
    // Twin towers + low block.
    return (
      <G>
        <Rect x={14} y={40} width={26} height={52} rx={2} fill={b} />
        <Rect x={44} y={28} width={24} height={64} rx={2} fill={d} />
        <Rect x={70} y={52} width={20} height={40} rx={2} fill={b} />
        {win(18, 46)}{win(26, 46)}{win(34, 46)}
        {win(18, 56)}{win(26, 56)}{win(34, 56)}
        {win(18, 66)}{win(26, 66)}{win(34, 66)}
        {win(48, 34)}{win(56, 34)}{win(48, 44)}{win(56, 44)}
        {win(48, 54)}{win(56, 54)}{win(48, 64)}{win(56, 64)}
        {win(74, 58)}{win(82, 58)}{win(74, 68)}{win(82, 68)}
      </G>
    );
  }
  if (v === 1) {
    // Single wide mid-rise with a pitched roof (villa-ish).
    return (
      <G>
        <Path d="M20 54 L50 34 L80 54 Z" fill={d} />
        <Rect x={26} y={54} width={48} height={38} rx={2} fill={b} />
        {win(32, 60, 6, 7)}{win(46, 60, 6, 7)}{win(60, 60, 6, 7)}
        <Rect x={44} y={76} width={12} height={16} rx={1} fill={d} />
      </G>
    );
  }
  if (v === 2) {
    // Staggered three towers.
    return (
      <G>
        <Rect x={10} y={48} width={20} height={44} rx={2} fill={b} />
        <Rect x={34} y={34} width={22} height={58} rx={2} fill={d} />
        <Rect x={60} y={44} width={22} height={48} rx={2} fill={b} />
        {win(14, 54)}{win(22, 54)}{win(14, 64)}{win(22, 64)}{win(14, 74)}{win(22, 74)}
        {win(39, 40)}{win(47, 40)}{win(39, 50)}{win(47, 50)}{win(39, 60)}{win(47, 60)}{win(39, 70)}{win(47, 70)}
        {win(65, 50)}{win(73, 50)}{win(65, 60)}{win(73, 60)}{win(65, 70)}{win(73, 70)}
      </G>
    );
  }
  // v === 3: tall slender high-rise + small house.
  return (
    <G>
      <Rect x={22} y={24} width={26} height={68} rx={2} fill={d} />
      {win(27, 30)}{win(35, 30)}{win(27, 40)}{win(35, 40)}
      {win(27, 50)}{win(35, 50)}{win(27, 60)}{win(35, 60)}{win(27, 70)}{win(35, 70)}
      <Path d="M56 60 L70 48 L84 60 Z" fill={b} />
      <Rect x={60} y={60} width={20} height={32} rx={1.5} fill={b} />
      {win(64, 66, 4, 5)}{win(72, 66, 4, 5)}
    </G>
  );
}

export default function PropertyArt({
  seed,
  width,
  height,
  borderRadius,
  style,
}: {
  seed?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = seedIndex(seed, 4);
  const sky = SKY[v % SKY.length];

  return (
    <View
      style={[
        s.wrap,
        width != null && { width: width as any },
        height != null && { height: height as any },
        borderRadius != null && { borderRadius },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`sky${v}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky} />
            <Stop offset="1" stopColor="#FFFDF8" />
          </LinearGradient>
        </Defs>
        {/* sky */}
        <Rect x={0} y={0} width={100} height={100} fill={`url(#sky${v})`} />
        {/* sun */}
        <Circle cx={82} cy={20} r={9} fill="#41806A" opacity={0.85} />
        {/* ground */}
        <Rect x={0} y={88} width={100} height={12} fill="#DCE5DE" />
        <Skyline v={v} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: '#E7F0EA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
