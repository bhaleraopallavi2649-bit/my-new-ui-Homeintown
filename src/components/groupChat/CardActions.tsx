import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Eye, UserPlus, Phone, Check } from '../../icons';
import { colors } from '../../theme';

// ── Shared card action row ──
// Used by all three property surfaces: the inventory card, the AI Match Found
// card and each requirement match row. Before this existed the inventory card
// hand-rolled its own button row, the match rows had a single Interested button,
// and the AI Match card had no actions at all — so "open this property" was
// missing exactly where matching results appear.
export type CardActionIcon = 'details' | 'join' | 'call' | 'interested';

const CARD_ACTION_ICON = {
  details: Eye,
  join: UserPlus,
  call: Phone,
  interested: Check,
} as const;

const CardActions = React.memo(function CardActions({ actions, tone }: {
  actions: Array<{ key: string; label: string; icon: CardActionIcon; ghost?: boolean; onPress: () => void }>;
  tone: 'green' | 'brand';
}) {
  // Warm theme to match the Lead Match property-card mini pills:
  //   • solid action  → orange (brand) fill, white label
  //   • ghost action  → cream pill with a soft border + light shadow, navy label
  const solidBg = tone === 'green' ? colors.greenText : colors.brand;
  const divider = tone === 'green' ? '#DCFCE7' : `${colors.brand}22`;

  return (
    <View style={[mbs.cardActions, { borderTopColor: divider }]}>
      {actions.map(action => {
        const Icon = CARD_ACTION_ICON[action.icon];
        const color = action.ghost ? colors.brand : '#fff';
        return (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            style={[
              mbs.cardActionBtn,
              action.ghost ? mbs.ghostPill : { backgroundColor: solidBg },
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Icon size={13} color={color} />
            <Text
              style={[mbs.cardActionText, { color: action.ghost ? '#17233A' : '#fff' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// Kept the object name `mbs` so the JSX body above is unchanged from when this
// lived in GroupChatEmbedded.tsx. These three keys had no reader outside
// CardActions, so they are module-local rather than shared.
const mbs = StyleSheet.create({
  // Shared CardActions row — one definition for the inventory card, the AI match
  // card and the requirement match rows. Colours come from the `tone` prop, so
  // only geometry lives here. minWidth:0 is what lets three buttons shrink
  // inside a narrow card instead of overflowing it.
  cardActions: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  cardActionBtn: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  // Cream pill with a soft warm border + light shadow — the Lead Match card look.
  ghostPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE3D1',
    shadowColor: '#2B4A3C',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export default CardActions;
