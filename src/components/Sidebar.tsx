// Custom slide-in sidebar (drawer) — replaces the bottom tab bar.
// Doesn't depend on react-native-reanimated (uses Animated API).
// Matches the website's left sidebar navigation.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Dimensions,
  ScrollView, Image, Linking, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
// Zap, MessageSquare and Clock were dropped with the four NAV_ITEMS entries
// below — nothing else in this file used them. `Users` is kept: it is still the
// footer Team row's icon and the Team-for-developers modal's icon, not a nav
// entry's.
import {
  LayoutDashboard, Building2, BarChart3, ShoppingBag,
  Users, Briefcase, Bell, User, Building, LogOut,
  X, Shield, Settings, CreditCard, FileText, ChevronRight, Home,
} from '../icons';
import { BottomWave } from './AuthDecor';
import { useAuth } from '../lib/authContext';
import { colors } from '../theme';
import { OVERVIEW_ROLES } from '../lib/roleRouting';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(300, SCREEN_W * 0.8);

interface NavItem {
  label: string;
  route: string;
  icon: any;
  roles: string[]; // which roles see this item ('*' = all)
}

// Four entries were removed from this list at the user's request:
//   AI Lead Matching → /(dashboard)/lead-matching
//   Chat             → /(dashboard)/chat
//   Field Team       → /(dashboard)/employees
//   Archive          → /(dashboard)/archive
//
// NAV ENTRIES ONLY. No route file was deleted and app/(dashboard)/_layout.tsx is
// untouched, so all four screens still exist and still resolve — they simply have
// no navigation path from this drawer any more. A repo-wide search found no other
// router.push to any of them, so that is the full picture, and it is the input to
// the pending dead-code cleanup rather than something to act on here.
//
// `lead-matching.tsx` in particular MUST STAY: crm.tsx imports it and renders it
// as the AI Leads tab, so deleting the file would break the Overview screen even
// though its route is now unreachable.
//
// `Field Check-in` is deliberately kept. It points at /(dashboard)/field, which is
// a DIFFERENT screen from Field Team's /(dashboard)/employees, and app/index.tsx
// redirects employee accounts to it.
const NAV_ITEMS: NavItem[] = [
  // D9: user/unassigned added (OVERVIEW_ROLES). They already land on Overview
  // from app/index.tsx but had no drawer entry to get back to it.
  { label: 'Overview',      route: '/(dashboard)/crm',           icon: LayoutDashboard, roles: [...OVERVIEW_ROLES] },
  { label: 'Projects',       route: '/(dashboard)/projects',      icon: Building2,       roles: ['admin', 'builder', 'captain', 'agent'] },
  { label: 'Marketplace',    route: '/(dashboard)/marketplace',   icon: ShoppingBag,     roles: ['admin', 'builder', 'captain'] },
  { label: 'Analytics',      route: '/(dashboard)/analytics',     icon: BarChart3,       roles: ['admin', 'builder'] },
  { label: 'Organizations',  route: '/(dashboard)/organizations', icon: Building,        roles: ['admin', 'builder'] },
  // Label reverted to 'Users' as part of the warm UI design brief. We had
  // renamed it to 'Role Distribution' to describe the screen (search + per-role
  // counts + role changes); the reskin brief explicitly asks for 'Users' back,
  // so this is an intentional label-only revert. Route/roles/server boundary are
  // unchanged: `roles: ['admin']` filters the entry out of `items` for everyone
  // else (PRESENTATION ONLY — the real boundary is the server's
  // restrictTo('admin') on GET /users and PUT /users/:id/role).
  { label: 'Users',            route: '/(dashboard)/admin-users', icon: Shield,       roles: ['admin'] },
  { label: 'Field Check-in', route: '/(dashboard)/field',         icon: Briefcase,       roles: ['employee'] },
  { label: 'My Card',        route: '/(dashboard)/my-card',       icon: CreditCard,      roles: ['*'] },
  { label: 'Meri Quotations', route: '/(dashboard)/quotations',   icon: FileText,        roles: ['*'] },
  { label: 'Notifications',  route: '/(dashboard)/notifications', icon: Bell,            roles: ['*'] },
  { label: 'Profile',        route: '/(dashboard)/profile',       icon: User,            roles: ['*'] },
];

interface Props {
  open: boolean;
  onClose: () => void;
  unread?: number;
}

export default function Sidebar({ open, onClose, unread = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const role = user?.role ?? 'user';
  const [showTeamDev, setShowTeamDev] = useState(false);

  const openTeam = () => {
    if (role === 'user') {
      setShowTeamDev(true);
    } else {
      onClose();
      Linking.openURL('https://www.oneemployee.in/');
    }
  };

  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const items = NAV_ITEMS.filter(item => item.roles.includes('*') || item.roles.includes(role));

  const navigate = (route: string) => {
    onClose();
    // small delay so the close animation feels smooth
    setTimeout(() => router.push(route as any), 60);
  };

  const isActive = (route: string) => {
    if (!pathname) return false;
    const seg = route.split('/').pop();
    return pathname.includes(seg || '___');
  };

  const initial = (user?.name || '?').charAt(0).toUpperCase();

  // Don't render anything when fully closed (perf)
  if (!open) {
    return (
      <Animated.View pointerEvents="none" style={[st.backdrop, { opacity: 0 }]} />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[st.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          st.drawer,
          { width: DRAWER_W, paddingTop: insets.top, transform: [{ translateX: slideX }] },
        ]}
      >

        {/* Brand header */}
        <View style={st.brandHeader}>
          <View style={st.brandRow}>
            <View style={st.logoBox}>
              <Home size={22} color="#fff" strokeWidth={2.4} />
            </View>
            <View>
              <Text style={st.brandName}>HomeInTown</Text>
              <Text style={st.brandSub}>Sales Intelligence</Text>
            </View>
          </View>
          {/* Icon-only close: label/role so TalkBack does not read "button, unlabeled". */}
          <Pressable onPress={onClose} style={st.closeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close menu">
            <X size={18} color={colors.muted2} />
          </Pressable>
        </View>

        {/* User card */}
        <View style={st.userCard}>
          {user?.businessLogoUrl ? (
            <Image source={{ uri: user.businessLogoUrl }} style={st.userAvatar} />
          ) : (
            <View style={st.userAvatarFallback}>
              <Text style={st.userAvatarText}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.userName} numberOfLines={1}>{user?.name || 'User'}</Text>
            <Text style={st.userRole}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </View>

        {/* Nav items */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
          <Text style={st.sectionLabel}>MENU</Text>
          {items.map(item => {
            const active = isActive(item.route);
            const Icon = item.icon;
            return (
              <Pressable
                key={item.route}
                onPress={() => navigate(item.route)}
                style={[st.navItem, active && st.navItemActive]}
              >
                {active && <View style={st.navActiveBar} />}
                <Icon size={20} color={'#1F4D3A'} />
                <Text style={[st.navLabel, active && st.navLabelActive]}>{item.label}</Text>
                {item.route.includes('notifications') && unread > 0 && (
                  <View style={st.navBadge}>
                    <Text style={st.navBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
                <ChevronRight size={16} color={active ? '#1F4D3A' : colors.muted} />
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Team + Settings + Sign out */}
        <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={openTeam} style={st.settingsBtn}>
            <Users size={18} color={'#1F4D3A'} />
            <Text style={st.settingsText}>Team</Text>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => navigate('/(dashboard)/settings')} style={st.settingsBtn}>
            <Settings size={18} color={'#1F4D3A'} />
            <Text style={st.settingsText}>Settings</Text>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => { onClose(); setTimeout(() => logout(), 100); }} style={st.signOut}>
            <LogOut size={18} color={colors.red} />
            <Text style={st.signOutText}>Sign Out</Text>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Team — under development popup (user role only) */}
      <Modal visible={showTeamDev} transparent animationType="fade" onRequestClose={() => setShowTeamDev(false)}>
        <Pressable style={st.devOverlay} onPress={() => setShowTeamDev(false)}>
          <Pressable style={st.devCard} onPress={() => {}}>
            <View style={st.devIcon}><Users size={26} color={'#1F4D3A'} /></View>
            <Text style={st.devTitle}>Team — Coming Soon</Text>
            <Text style={st.devMsg}>This feature is under development. We'll notify you once your team workspace is ready.</Text>
            <Pressable style={st.devBtn} onPress={() => setShowTeamDev(false)}>
              <Text style={st.devBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#EAF8EE',
    borderRightWidth: 1, borderRightColor: colors.line,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  brandHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1F4D3A', alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontWeight: '800', fontSize: 19 },
  brandName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  brandSub: { fontSize: 9, color: '#1F4D3A', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.slateBg },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    padding: 12, borderRadius: 14,
    backgroundColor: '#EAF8EE', borderWidth: 1, borderColor: colors.line,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F4D3A', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  userName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  userRole: { fontSize: 11, color: '#1F4D3A', fontWeight: '600', marginTop: 1 },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.muted, letterSpacing: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
    marginHorizontal: 0, overflow: 'hidden',
  },
  navItemActive: { backgroundColor: '#E7F0EA' },
  navActiveBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#1F4D3A' },
  navLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  navLabelActive: { color: '#1F4D3A', fontWeight: '700' },
  navBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  navBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  settingsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  settingsText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  signOut: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  signOutText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.red },

  // Team — under development popup
  devOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  devCard: { width: '100%', maxWidth: 340, backgroundColor: colors.white, borderRadius: 20, padding: 22, alignItems: 'center' },
  devIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E7F0EA', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  devTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  devMsg: { fontSize: 13, color: colors.muted2, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  devBtn: { backgroundColor: '#1F4D3A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, alignSelf: 'stretch', alignItems: 'center' },
  devBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
