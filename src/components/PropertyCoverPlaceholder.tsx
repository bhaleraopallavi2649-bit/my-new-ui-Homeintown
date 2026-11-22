// Placeholder for listings/cards that have no real cover image from the API.
//
// Uses one of 10 bundled property building photos picked deterministically from
// the seed so different cards show different buildings and a single card never
// changes between renders.
//
// Photos are loaded via the `asset:/` URI scheme which reads directly from
// android/app/src/main/assets/ — bypassing Metro's JS-bundle asset pipeline,
// so they always load regardless of Metro config. The same URIs work on iOS
// via the bundle's asset catalogue. On the web they gracefully fall back to the
// peach tile (the Image onError handler below).
//
// IMPORTANT: real API images are NEVER overridden here. Every call site already
// guards: `coverUrl ? <Image uri={coverUrl}> : <PropertyCoverPlaceholder>`.

import React, { useState } from 'react';
import { View, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Building2 } from '../icons';
import { colors } from '../theme';
import { seedIndex } from './placeholders/seed';

// 10 property building photos in android/app/src/main/assets/.
// Loaded via asset:/ URI — no Metro require() needed.
const PROPERTY_URIS = [
  'asset:/prop1.jpg',
  'asset:/prop2.jpg',
  'asset:/prop3.jpg',
  'asset:/prop4.jpg',
  'asset:/prop5.jpg',
  'asset:/prop6.jpg',
  'asset:/prop7.jpg',
  'asset:/prop8.jpg',
  'asset:/prop9.jpg',
  'asset:/prop10.jpg',
];

export default function PropertyCoverPlaceholder({
  width,
  height,
  size,
  seed,
  style,
  borderRadius,
}: {
  width?: number | string;
  height?: number | string;
  // Kept for call-site compatibility (was the icon size); unused now.
  size?: number;
  // A stable identifier (project id / title / message id) used to pick which
  // bundled photo shows. Same seed → same photo every time, varied across cards.
  seed?: string;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const uri = PROPERTY_URIS[seedIndex(seed, PROPERTY_URIS.length)];
  const iconSize =
    size ??
    (typeof height === 'number' ? Math.max(20, Math.min(56, Math.round(height * 0.4))) : 28);

  return (
    <View
      style={[
        s.tile,
        width != null && { width: width as any },
        height != null && { height: height as any },
        borderRadius != null && { borderRadius },
        style,
      ]}
    >
      {!failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        // Graceful fallback if the asset URI somehow fails.
        <Building2 size={iconSize} color={colors.brand} strokeWidth={1.75} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    backgroundColor: '#E7F0EA',
    borderWidth: 1,
    borderColor: '#C9DCCF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
