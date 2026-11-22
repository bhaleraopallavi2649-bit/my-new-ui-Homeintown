// Property Group Info screen (reference screens 2, 4, 5, 6).
//
// One full-screen modal that adapts to the viewer's state:
//   • not a member            → View Group + Join Group buttons
//   • member                  → View Group (opens chat) + View Members (member
//                               names list), Recent Activity, small Group Chat
//   • private, not a member   → "Request to Join"
//   • private, request sent   → "Request Pending" banner
//
// The layout is deliberately compact so the member view fits on one screen
// without scrolling (the ScrollView stays only as a safety net for very small
// devices or large font sizes).
//
// It reuses the existing room data (GroupRoom) and the existing chat/join
// handlers passed in by GroupChatEmbedded; it adds no new API surface.

import React, { useState } from 'react';
import SlidePageModal from '../SlidePageModal';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { ArrowLeft, MapPin, Users, Building2, Info, MessageCircle, Eye, Check, X } from '../../icons';
import { colors } from '../../theme';
import type { GroupRoom, InventoryCard } from '../../lib/api';
import PropertyCoverPlaceholder from '../PropertyCoverPlaceholder';
import BuilderAvatar from '../placeholders/BuilderAvatar';

export type JoinState = 'none' | 'member' | 'pending';

export default function PropertyGroupInfo({
  visible, onClose, inv, room, projectId, joinState, isPrivate, joining,
  onJoin, onRequestJoin, onOpenChat,
}: {
  visible: boolean;
  onClose: () => void;
  inv: InventoryCard | null;
  room?: GroupRoom | null;
  projectId: string;
  joinState: JoinState;
  isPrivate: boolean;
  joining: boolean;
  onJoin: () => void;
  onRequestJoin: () => void;
  onOpenChat: () => void;
}) {
  // Hooks must run before the early return below.
  const [showMembers, setShowMembers] = useState(false);

  if (!inv) return null;

  const proj: any = room?.project;
  const title = room?.project?.projectName || inv.projectName || 'Property';
  const location = [proj?.location || inv.area, proj?.city || inv.city].filter(Boolean).join(', ');
  const members = room?.members || [];
  const memberCount = members.length;
  const admins = members.filter(m => m.role === 'admin');
  const cover = proj?.media?.coverImage?.url
    || (typeof inv.project === 'object' && inv.project ? (inv.project as any)?.media?.coverImage?.url : '')
    || '';
  // A room that wraps a single property is an "Individual Group"; a company /
  // area / universal room spans many properties.
  const isIndividual = !room || room.roomType === 'project';
  const groupType = room?.isUniversal || room?.roomType === 'universal' ? 'Universal Group'
    : room?.roomType === 'builder' ? 'Company Group'
    : room?.roomType === 'area' ? 'Area Group'
    : 'Individual Group';
  const rows: Array<[string, string]> = [
    isIndividual ? ['Property Type', inv.propertyType || proj?.propertyType || '—'] : ['Project Name', title],
    ['Location', location || '—'],
    ['Group Type', groupType],
  ];
  const recent = [...members]
    .filter(m => m.joinedAt)
    .sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt)))
    .slice(0, 2);

  // Admins first, then everyone else alphabetically.
  const sortedMembers = [...members].sort((a, b) => {
    if ((a.role === 'admin') !== (b.role === 'admin')) return a.role === 'admin' ? -1 : 1;
    return (a.user.name || '').localeCompare(b.user.name || '');
  });

  return (
    <SlidePageModal visible={visible} onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.topBar}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Back"><ArrowLeft size={22} color={colors.ink} /></Pressable>
          <Text style={s.topTitle}>Group Info</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            {cover ? (
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <PropertyCoverPlaceholder style={StyleSheet.absoluteFill} seed={projectId || title} />
            )}
            <View style={[s.badge, isIndividual ? s.badgeGreen : s.badgeWhite]}>
              {isIndividual ? <View style={s.dot} /> : <Users size={12} color={colors.ink} />}
              <Text style={s.badgeText}>{groupType}</Text>
            </View>
          </View>

          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <View style={s.metaRow}>
            <MapPin size={13} color={colors.muted2} />
            <Text style={s.meta} numberOfLines={1}>{[location, memberCount ? `${memberCount} Members` : ''].filter(Boolean).join('  |  ')}</Text>
          </View>

          {/* Request sent (private group) */}
          {joinState === 'pending' && (
            <View style={s.sent}>
              <View style={s.sentIcon}><Check size={22} color="#fff" strokeWidth={3} /></View>
              <Text style={s.sentTitle}>Request Sent!</Text>
              <Text style={s.sentSub}>Your request has been sent.</Text>
              <View style={s.statusPill}>
                <Text style={s.statusLabel}>Status:</Text>
                <Text style={s.statusValue}>Request Pending</Text>
              </View>
              <View style={s.pending}>
                <Info size={18} color="#2563EB" />
                <Text style={s.pendingText}>
                  Admin approval का इंतजार करना होगा। Approve होते ही आप group के member बन जाएंगे और chat access मिल जाएगा।
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          {joinState !== 'pending' && (
            <View style={s.actions}>
              <Pressable style={s.ghostBtn} onPress={joinState === 'member' ? onOpenChat : onClose} accessibilityRole="button">
                <Eye size={16} color={colors.ink} />
                <Text style={s.ghostText}>View Group</Text>
              </Pressable>
              {joinState === 'member' ? (
                <Pressable
                  style={s.softBtn}
                  onPress={() => setShowMembers(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View Members"
                >
                  <Users size={16} color={colors.brandDark} />
                  <Text style={s.softText}>View Members</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[s.solidBtn, joining && { opacity: 0.65 }]}
                  onPress={isPrivate ? onRequestJoin : onJoin}
                  disabled={joining}
                  accessibilityRole="button"
                >
                  {joining ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Users size={16} color="#fff" />
                      <Text style={s.solidText}>{isPrivate ? 'Request to Join' : 'Join Group'}</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}

          <Text style={s.section}>Group Details</Text>
          <View style={s.card}>
            {rows.map(([k, v]) => (
              <View key={k} style={s.row}>
                <Building2 size={14} color={colors.brand} />
                <Text style={s.rowKey}>{k}</Text>
                <Text style={s.rowSep}>:</Text>
                <Text style={s.rowVal} numberOfLines={1}>{v}</Text>
              </View>
            ))}
            {admins.length > 0 && (
              <View style={s.row}>
                <Users size={14} color={colors.brand} />
                <Text style={s.rowKey}>Admin</Text>
                <Text style={s.rowSep}>:</Text>
                <Text style={s.rowVal} numberOfLines={1}>{admins.map(a => a.user.name).filter(Boolean).join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Members row. For a member the small Group Chat pill sits on the
              right of this row instead of taking a full row of its own. */}
          {memberCount > 0 && joinState !== 'pending' && (
            <>
              <View style={s.sectionRow}>
                <Text style={s.sectionInline}>Members ({memberCount})</Text>
                {joinState === 'member' && (
                  <Pressable style={s.chatPill} onPress={onOpenChat} accessibilityRole="button" accessibilityLabel="Group Chat">
                    <MessageCircle size={13} color={colors.brandDark} />
                    <Text style={s.chatPillText}>Group Chat</Text>
                  </Pressable>
                )}
              </View>
              <View style={s.avatars}>
                {members.slice(0, 6).map((m, i) => (
                  <BuilderAvatar key={`${m.user.id}-${i}`} name={m.user.name} seed={m.user.id} size={30} style={s.avatar} />
                ))}
                {memberCount > 6 && (
                  <View style={s.more}><Text style={s.moreText}>+{memberCount - 6}</Text></View>
                )}
              </View>
            </>
          )}

          {/* Recent activity (member view, screen 4) */}
          {joinState === 'member' && recent.length > 0 && (
            <>
              <Text style={s.section}>Recent Activity</Text>
              <View style={s.card}>
                {recent.map((m, i) => (
                  <View key={`${m.user.id}-${i}`} style={s.activity}>
                    <BuilderAvatar name={m.user.name} seed={m.user.id} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actName} numberOfLines={1}>{m.user.name || 'Member'}</Text>
                      <Text style={s.actSub}>joined the group</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Member names (opened by View Members) */}
      <Modal visible={showMembers} transparent animationType="slide" onRequestClose={() => setShowMembers(false)} statusBarTranslucent>
        <Pressable style={s.overlay} onPress={() => setShowMembers(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Group Members</Text>
                <Text style={s.sheetSub} numberOfLines={1}>{title} · {memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
              </View>
              <Pressable onPress={() => setShowMembers(false)} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {sortedMembers.length === 0 ? (
                <Text style={s.empty}>No members to show.</Text>
              ) : sortedMembers.map((m, i) => (
                <View key={`${m.user.id}-${i}`} style={s.memberRow}>
                  <BuilderAvatar name={m.user.name} seed={m.user.id} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.memberName} numberOfLines={1}>{m.user.name || 'Member'}</Text>
                    {!!(m.user.role || m.user.companyName) && (
                      <Text style={s.memberMeta} numberOfLines={1}>
                        {[m.user.role, m.user.companyName].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  {m.role === 'admin' && (
                    <View style={s.adminPill}><Text style={s.adminPillText}>Admin</Text></View>
                  )}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SlidePageModal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF8EE' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 36, paddingBottom: 8, paddingHorizontal: 16 },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  hero: { marginHorizontal: 16, height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E7F0EA' },
  badge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  badgeWhite: { backgroundColor: 'rgba(255,255,255,0.92)' },
  badgeGreen: { backgroundColor: '#E6F7EA' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22A04B' },
  badgeText: { fontSize: 11.5, fontWeight: '800', color: colors.ink },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2, paddingHorizontal: 16 },
  meta: { fontSize: 12, color: colors.muted2 },
  sent: { alignItems: 'center', marginTop: 12 },
  sentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#22A04B', alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 8 },
  sentSub: { fontSize: 12.5, color: colors.muted2, marginTop: 2 },
  statusPill: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: '#E7F0EA' },
  statusLabel: { fontSize: 12, fontWeight: '700', color: colors.brandDark },
  statusValue: { fontSize: 12, fontWeight: '800', color: colors.brandDark },
  pending: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', alignSelf: 'stretch', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#E7F0FD', borderWidth: 1, borderColor: '#BFD6F8' },
  pendingText: { flex: 1, fontSize: 12.5, color: '#1E3A8A', fontWeight: '600', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  ghostBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: '#fff' },
  ghostText: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  solidBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 22, backgroundColor: colors.brand },
  solidText: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  softBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 22, backgroundColor: '#E7F0EA' },
  softText: { fontSize: 13.5, fontWeight: '800', color: colors.brandDark },
  section: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 12, marginBottom: 6, paddingHorizontal: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6, paddingHorizontal: 16 },
  sectionInline: { fontSize: 14, fontWeight: '800', color: colors.ink },
  chatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#E7F0EA' },
  chatPillText: { fontSize: 11, fontWeight: '800', color: colors.brandDark },
  card: { marginHorizontal: 16, padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE5D8', gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowKey: { width: 96, fontSize: 12.5, fontWeight: '600', color: colors.muted2 },
  rowSep: { fontSize: 12.5, color: colors.muted2 },
  rowVal: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.ink },
  avatars: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6 },
  avatar: { borderWidth: 2, borderColor: '#fff' },
  more: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E7F0EA', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 10.5, fontWeight: '800', color: colors.brandDark },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actName: { fontSize: 13, fontWeight: '800', color: colors.ink },
  actSub: { fontSize: 11.5, color: colors.muted2 },
  // Members sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', backgroundColor: '#EAF8EE', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sheetSub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ECE5D8' },
  memberName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  memberMeta: { fontSize: 11.5, color: colors.muted2, marginTop: 1 },
  adminPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E7F0EA' },
  adminPillText: { fontSize: 10.5, fontWeight: '800', color: colors.brandDark },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 24, fontSize: 13 },
});
