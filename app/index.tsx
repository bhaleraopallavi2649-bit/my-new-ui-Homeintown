import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/authContext';
import { colors } from '../src/theme';
import OfflineRetryScreen from '../src/components/OfflineRetryScreen';
import { homeRouteForRole } from '../src/lib/roleRouting';

// Entry route — redirects to the role-appropriate home tab.
export default function Index() {
  const { status, user, checkAuth } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: colors.brand, marginBottom: 12 }}>HomeInTown</Text>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // D3: server unreachable after bounded retries. Not a logout, so no /login.
  if (status === 'offline') {
    return <OfflineRetryScreen onRetry={checkAuth} />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/login" />;
  }

  // Role-based home screen (roleRouting.ts, tested): employee → Field, every
  // other role including user/unassigned → Overview.
  return <Redirect href={homeRouteForRole(user?.role) as any} />;
}
