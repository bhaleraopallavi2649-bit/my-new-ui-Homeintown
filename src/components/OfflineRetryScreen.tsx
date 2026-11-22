// D3: shown when the cold-start session check could not reach the server after
// its bounded retries. PREVIOUS BEHAVIOUR: the same failure sent the user to
// the login screen even though their stored token was valid. There is
// deliberately no logout button: the user is still signed in.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function OfflineRetryScreen({ onRetry }: { onRetry: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try { await onRetry(); } finally { setBusy(false); }
  };
  return (
    <View style={s.root}>
      <Text style={s.brand}>HomeInTown</Text>
      <Text style={s.title} accessibilityRole="header">You're offline</Text>
      <Text style={s.body}>
        We couldn't reach HomeInTown. Check your connection and try again. You are still signed in.
      </Text>
      <Pressable
        onPress={retry}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => [s.btn, (pressed || busy) && s.btnPressed]}
      >
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Retry</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] },
  brand: { fontSize: 21, fontWeight: 'bold', color: colors.brand, marginBottom: spacing.xl },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  body: { fontSize: 14, color: colors.muted2, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  btn: { minHeight: 44, minWidth: 140, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnPressed: { backgroundColor: colors.brandDark },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
