import React, { useEffect, useState } from 'react';
import { View, AppState, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/lib/authContext';
import { isSessionReady } from '../../src/lib/sessionResolve';
import { notificationsApi } from '../../src/lib/api';
import { SidebarProvider, useSidebar } from '../../src/lib/sidebarContext';
import Sidebar from '../../src/components/Sidebar';
import { colors } from '../../src/theme';
import OfflineRetryScreen from '../../src/components/OfflineRetryScreen';

function DashboardShell() {
  const { open, closeSidebar } = useSidebar();
  const [unread, setUnread] = useState(0);

  // Unread badge polling. The interval used to run unconditionally, so a
  // backgrounded app kept making a request every minute for as long as the
  // process lived. Now polling stops when the app leaves the foreground and
  // fires once immediately on return, so the badge is still fresh on resume.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    // Android commonly emits a 'change' → 'active' event shortly after the
    // activity settles, even though the app was already active. Without tracking
    // the previous state, that fired a SECOND unread request milliseconds after
    // the one on mount (visible in the server logs as duplicate
    // /notifications?limit=1 calls ~150ms apart).
    let lastState = AppState.currentState;

    const fetchUnread = () =>
      notificationsApi.list({ limit: 1 }).then(r => setUnread(r.unreadCount)).catch(() => {});

    const startPolling = () => {
      if (timer) return;
      timer = setInterval(fetchUnread, 60000);
    };
    const stopPolling = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if (lastState === 'active') {
      fetchUnread();
      startPolling();
    }

    const sub = AppState.addEventListener('change', state => {
      const wasActive = lastState === 'active';
      lastState = state;

      if (state !== 'active') {
        stopPolling();
        return;
      }
      // Only a real background → foreground transition needs a refresh.
      if (wasActive) return;
      fetchUnread();
      startPolling();
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* All dashboard screens as a stack (no bottom tab bar) */}
      <Stack
        screenOptions={{
          headerShown: false,
          // Cream behind every screen so a transition never flashes white.
          contentStyle: { backgroundColor: colors.cream },
          // Native slide: a pushed screen enters from the right, and going back
          // slides it out to the right, revealing the previous screen. Runs on
          // the native thread (react-native-screens), so JS work can't stutter it.
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
          animationDuration: 280,
          // Swipe-back: iOS edge/full-screen swipe; Android uses the system
          // back gesture, which plays the same reverse slide.
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          // freezeOnBlur deliberately NOT enabled: it can leave the previous
          // screen blank for a frame while the back slide starts.
        }}
      >
        <Stack.Screen name="crm" />
        <Stack.Screen name="crm-leads" />
        <Stack.Screen name="projects" />
        <Stack.Screen name="add-project" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="lead-matching" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="employees" />
        <Stack.Screen name="organizations" />
        <Stack.Screen name="admin-users" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="group-chat" />
        <Stack.Screen name="captain-team" />
        <Stack.Screen name="field" />
        <Stack.Screen name="archive" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="my-card" />
        <Stack.Screen name="quotations" />
        <Stack.Screen name="quotation-new" />
        <Stack.Screen name="settings" />
      </Stack>

      {/* Slide-in sidebar overlays everything */}
      <Sidebar open={open} onClose={closeSidebar} unread={unread} />
    </View>
  );
}

export default function DashboardLayout() {
  const { status, user } = useAuth();
  const { checkAuth } = useAuth();
  // D3: a deep-link cold start lands here, not in app/index.tsx, so the
  // offline screen is needed in this gate too (otherwise a spinner forever).
  if (status === 'offline') return <OfflineRetryScreen onRetry={checkAuth} />;
  // P6-03b: this layout used to render its screens whatever the auth status.
  // AI Assist and the group chat read per-user AsyncStorage keys on mount, so a
  // deep-link cold start (or an account switch) could mount them — and read the
  // PREVIOUS user's keys — before storageOwner.ensure finished. Nothing below
  // mounts until the user is resolved; on logout the screens unmount at once.
  // Status is only 'loading' during checkAuth (cold start / login screen) or an
  // account switch, never during normal use, so this does not remount screens.
  if (!isSessionReady(status, user)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return (
    <SidebarProvider>
      <DashboardShell />
    </SidebarProvider>
  );
}
