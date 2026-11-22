import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { BadgeCheck } from '../../icons';
import type { GroupRoom } from '../../lib/api';
import type { RoomProfile } from '../../lib/groupChat/avatars';
import { roomDisplayName, roomLines, roomIsVerified } from '../../lib/groupChat/rooms';
import RoomAvatar from './RoomAvatar';

// ── Room list row ──
// One row for BOTH sections. Joined and discoverable rows previously had their
// own near-identical components (and the discover variant was additionally
// duplicated between an inline list and a modal), which let the two drift apart.
// `joined` is the only thing that differs: the trailing slot shows either
// activity time + unread badge, or a Join button.
const GroupRow = React.memo(function GroupRow({ room, joined, joining, onPress, onJoin, cache }: {
  room: GroupRoom;
  joined: boolean;
  joining?: boolean;
  onPress?: (room: GroupRoom) => void;
  onJoin?: (room: GroupRoom) => void;
  // The avatar fallback cache, not the avatar itself — the row's picture comes
  // from room.avatar when the server has one. Renamed from `profilePictures`
  // (and off `any`) so that subordinate role is legible at the call site.
  cache: Record<string, RoomProfile>;
}) {
  const { primary, secondary } = roomLines(room);
  const verified = roomIsVerified(room);
  const unread = joined ? (room.unreadCount || 0) : 0;
  // Sponsored flag. The GroupRoom type has no such field yet, so it is read
  // through a cast: the backend only has to start sending `isSponsored: true`
  // on a room and the "Sponsored" label below lights up — no further UI change.
  const sponsored = (room as any).isSponsored === true;

  return (
    <Pressable
      onPress={joined ? () => onPress?.(room) : undefined}
      disabled={!joined}
      style={[s.roomRow, room.isUniversal && s.roomRowPinned]}
    >
      <View style={[s.roomAvatar, room.isUniversal && { backgroundColor: GREEN }]}>
        <RoomAvatar room={room} cache={cache} palette="green" />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.roomNameRow}>
          <Text style={[s.roomName, room.isUniversal && { color: GREEN }]} numberOfLines={1}>
            {roomDisplayName(room)}
          </Text>
          {/* Verified builders show a blue verification tick next to the name
              (bigger + blue per the UI request; was a smaller green tick). */}
          {verified && (
            <BadgeCheck size={18} color="#1F8A4C" style={s.verifiedTick} />
          )}
          {/* Sponsored groups carry a small "Sponsored" label. */}
          {sponsored && (
            <View style={s.sponsoredTag}>
              <Text style={s.sponsoredText}>Sponsored</Text>
            </View>
          )}
        </View>

        <Text style={s.roomMeta} numberOfLines={1}>{primary}</Text>
        {!!secondary && <Text style={s.roomMetaSecondary} numberOfLines={1}>{secondary}</Text>}
      </View>

      {joined ? (
        // The "5d / 6d / 9d" last-activity time was dropped per the UI request;
        // only the unread-count badge remains in the trailing slot (and nothing
        // at all when there are no unread messages).
        unread > 0 ? (
          <View style={s.roomTrailing}>
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          </View>
        ) : null
      ) : (
        <Pressable
          onPress={() => onJoin?.(room)}
          disabled={joining}
          style={[s.smallJoin, joining && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Join ${roomDisplayName(room)}`}
        >
          {joining
            ? <ActivityIndicator size="small" color={GREEN} />
            : <Text style={s.smallJoinText}>Join Group</Text>}
        </Pressable>
      )}
    </Pressable>
  );
});

// Kept named `s` so the JSX body above is byte-identical to what it was inside
// GroupChatEmbedded.tsx. Every one of these keys was measured at exactly one
// reference, all of them in this component, so none of them are shared.
// Green theme (matches the Home / Properties page).
const GREEN = '#1F4D3A';
const GREEN_SOFT = '#E7F0EA';
const GREEN_LINE = '#C9DCCF';

const s = StyleSheet.create({
  // Flat list row — no card box, border or shadow (user request). Rows are
  // separated by RoomSeparator's hairline instead.
  roomRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  roomRowPinned: { backgroundColor: GREEN_SOFT },
  // 54px soft-green avatar circle.
  roomAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: GREEN_SOFT, borderWidth: 1, borderColor: GREEN_LINE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  roomName: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  // Blue verification tick shown next to a verified builder's name (replaces the
  // old "Company" chip + "Verified" text; now bigger + blue).
  verifiedTick: { flexShrink: 0 },
  // "Sponsored" label pill — a soft peach badge next to the name.
  sponsoredTag: { flexShrink: 0, backgroundColor: GREEN_SOFT, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  sponsoredText: { fontSize: 9.5, fontWeight: '800', color: GREEN, letterSpacing: 0.2 },
  roomMeta: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  roomMetaSecondary: { fontSize: 12, fontWeight: '500', color: colors.muted2, marginTop: 1 },
  roomTrailing: { alignItems: 'flex-end', gap: 5 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  // "Join Group": white pill with an orange outline and a dark label (reference),
  // ~40dp tall so it is easy to hit. Was a brandTint fill with a brand label; the
  // white/outline look reads as a clearer call to action on the cream card. The
  // LABEL stays "Join Group" (never "Chat Now") — see the JSX above.
  // Boxless "Join Group": green text only, no fill / border (user request).
  // minHeight keeps a comfortable tap target.
  smallJoin: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  smallJoinText: { fontSize: 14, fontWeight: '800', color: GREEN },
});

export default GroupRow;
