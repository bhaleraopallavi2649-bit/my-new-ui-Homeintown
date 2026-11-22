// "Join Group" page — opened from the Join Group button on a property card.
//
// Page 1 (not yet requested): group name + type, total members, a short intro,
//   an orange "Request to Join" button and a Cancel button.
// Page 2 (private group, after Request to Join): "Request Sent!" with the
//   pending status and the admin-approval note.
//
// For a PUBLIC group "Request to Join" joins straight away and the caller opens
// the group chat. For a PRIVATE group it only records a request (see
// GroupChatEmbedded.pendingRequests) — approval has to happen on the server.

import React from 'react';
import SlidePageModal from '../SlidePageModal';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Users, Building2, Check, Info, MapPin } from '../../icons';
import { colors } from '../../theme';
import type { GroupRoom, InventoryCard } from '../../lib/api';

export default function JoinGroupPage({
  visible, inv, room, requestSent, joining, onRequest, onCancel,
}: {
  visible: boolean;
  inv: InventoryCard | null;
  room?: GroupRoom | null;
  requestSent: boolean;
  joining: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  if (!inv) return null;

  const title = room?.project?.projectName || inv.projectName || 'Property';
  const location = [(room?.project as any)?.location || inv.area, room?.project?.city || inv.city]
    .filter(Boolean).join(', ');
  // A room that wraps one property is an "Individual Group".
  const groupType = !room || room.roomType === 'project' ? 'Individual Group'
    : room.roomType === 'builder' ? 'Company Group'
    : room.roomType === 'area' ? 'Area Group'
    : 'Universal Group';
  const memberCount = room?.members?.length ?? null;
  const intro = (room?.description || '').trim()
    || `Discussion and updates for ${title}. Buyers, owners, brokers and interested members can connect here.`;

  return (
    <SlidePageModal visible={visible} onRequestClose={onCancel}>
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {requestSent ? (
            <View style={s.center}>
              <View style={s.tick}><Check size={34} color="#fff" strokeWidth={3} /></View>
              <Text style={s.sentTitle}>Request Sent!</Text>
              <Text style={s.sentSub}>Your request has been sent.</Text>
              <View style={s.statusPill}>
                <Text style={s.statusLabel}>Status:</Text>
                <Text style={s.statusValue}>Request Pending</Text>
              </View>
              <View style={s.note}>
                <Info size={18} color="#2563EB" />
                <Text style={s.noteText}>Admin approval का इंतजार करना होगा।</Text>
              </View>
              <Pressable style={s.solid} onPress={onCancel} accessibilityRole="button">
                <Text style={s.solidText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={s.heading}>Join Group</Text>

              <View style={s.card}>
                <View style={s.groupIcon}><Building2 size={26} color={colors.brand} /></View>
                <Text style={s.name}>{title}</Text>
                {!!location && (
                  <View style={s.locRow}>
                    <MapPin size={12} color={colors.muted2} />
                    <Text style={s.loc}>{location}</Text>
                  </View>
                )}
                <View style={s.typePill}>
                  <Users size={12} color={colors.brandDark} />
                  <Text style={s.typeText}>{groupType}</Text>
                </View>
              </View>

              <View style={s.rows}>
                <View style={s.row}>
                  <Text style={s.rowKey}>Group Type</Text>
                  <Text style={s.rowVal}>{groupType}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.rowKey}>Total Members</Text>
                  <Text style={s.rowVal}>{memberCount === null ? '—' : memberCount}</Text>
                </View>
              </View>

              <Text style={s.introTitle}>About this group</Text>
              <Text style={s.intro}>{intro}</Text>

              <Pressable
                style={[s.solid, joining && { opacity: 0.65 }]}
                onPress={onRequest}
                disabled={joining}
                accessibilityRole="button"
                accessibilityLabel="Request to Join"
              >
                {joining ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={s.solidText}>Request to Join</Text>
                )}
              </Pressable>
              <Pressable style={s.cancel} onPress={onCancel} disabled={joining} accessibilityRole="button">
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </SlidePageModal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF8EE' },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 18 },
  card: { alignItems: 'center', padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE5D8' },
  groupIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E7F0EA', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink, marginTop: 10, textAlign: 'center' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  loc: { fontSize: 12.5, color: colors.muted2 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#E6F7EA' },
  typeText: { fontSize: 12, fontWeight: '800', color: colors.brandDark },
  rows: { marginTop: 16, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE5D8', paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECE5D8' },
  rowKey: { fontSize: 13, color: colors.muted2, fontWeight: '600' },
  rowVal: { fontSize: 13.5, color: colors.ink, fontWeight: '800' },
  introTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 18 },
  intro: { fontSize: 13, color: colors.muted2, lineHeight: 19, marginTop: 4 },
  solid: { marginTop: 24, paddingVertical: 14, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  solidText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancel: { marginTop: 10, paddingVertical: 13, borderRadius: 26, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: '#fff', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  center: { alignItems: 'center', paddingTop: 40 },
  tick: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#22A04B', alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 16 },
  sentSub: { fontSize: 14, color: colors.muted2, marginTop: 4 },
  statusPill: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#E7F0EA' },
  statusLabel: { fontSize: 13, fontWeight: '700', color: colors.brandDark },
  statusValue: { fontSize: 13, fontWeight: '800', color: colors.brandDark },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', alignSelf: 'stretch', marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: '#E7F0FD', borderWidth: 1, borderColor: '#BFD6F8' },
  noteText: { flex: 1, fontSize: 13.5, color: '#1E3A8A', fontWeight: '700' },
});
