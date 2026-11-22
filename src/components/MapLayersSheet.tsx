// MapLayersSheet — Google-Maps-style "Map details" bottom sheet for the
// Project tab map (PropertyMap.tsx), opened from its layers button.
//
// Stateless on purpose: PropertyMap owns base type / labels / traffic / tap
// mode, because the MapView props and the map's onPress both read them.
//
// Transit and Biking from the Google Maps reference are NOT here:
// react-native-maps 1.18 exposes `showsTraffic` but no transit or bicycling
// layer prop, so those tiles would have been switches that do nothing.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { X, Car, PersonStanding, Ruler, MapIcon, Satellite, Mountain, Check } from '../icons';
import type { LucideIcon } from '../icons';
import { colors } from '../theme';
import type { MapBaseType } from '../lib/mapLayers';

export type MapTapMode = 'streetview' | 'measure' | null;

interface Props {
  visible: boolean;
  onClose: () => void;
  base: MapBaseType;
  onBaseChange: (b: MapBaseType) => void;
  labels: boolean;
  onLabelsChange: (v: boolean) => void;
  traffic: boolean;
  onTrafficChange: (v: boolean) => void;
  tapMode: MapTapMode;
  onTapModeChange: (m: MapTapMode) => void;
}

function Tile({
  Icon, label, active, onPress, tint, iconColor, a11yHint,
}: {
  Icon: LucideIcon; label: string; active: boolean; onPress: () => void;
  tint: string; iconColor: string; a11yHint?: string;
}) {
  return (
    <Pressable
      style={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={a11yHint}
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.tileBox, { backgroundColor: tint }, active && styles.tileBoxActive]}>
        <Icon size={24} color={iconColor} />
      </View>
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function MapLayersSheet({
  visible, onClose, base, onBaseChange, labels, onLabelsChange,
  traffic, onTrafficChange, tapMode, onTapModeChange,
}: Props) {
  // Street View and Measure both need the user to tap the map, which the sheet
  // covers, so picking either closes the sheet straight away.
  const pickMode = (m: Exclude<MapTapMode, null>) => {
    onTapModeChange(tapMode === m ? null : m);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close map details" />
        <View style={styles.sheet}>
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.header}>
            <Text style={styles.title}>Map details</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.row}>
              <Tile Icon={Car} label="Traffic" active={traffic} onPress={() => onTrafficChange(!traffic)}
                tint={colors.greenBg} iconColor={colors.greenText} />
              <Tile Icon={PersonStanding} label="Street View" active={tapMode === 'streetview'}
                onPress={() => pickMode('streetview')} tint={colors.blueBg} iconColor={colors.blueText}
                a11yHint="Then tap a spot on the map to open Street View" />
              <Tile Icon={Ruler} label="Measure" active={tapMode === 'measure'}
                onPress={() => pickMode('measure')} tint={colors.cyanBg} iconColor={colors.cyanText}
                a11yHint="Then tap points on the map to measure distance" />
            </View>

            <View style={styles.divider} />
            <Text style={styles.section}>Map type</Text>
            <View style={styles.row}>
              <Tile Icon={MapIcon} label="Default" active={base === 'default'} onPress={() => onBaseChange('default')}
                tint={colors.slateBg} iconColor={colors.slateText} />
              {/* Warm reskin: was tint={colors.night2}. night2 flipped from dark
                  #292524 to pale peach, which made the white Satellite icon
                  invisible. Pinned to ink (navy) so the dark map-type tile keeps
                  its intent and the white icon stays readable. */}
              <Tile Icon={Satellite} label="Satellite" active={base === 'satellite'} onPress={() => onBaseChange('satellite')}
                tint={colors.ink} iconColor={colors.white} />
              <Tile Icon={Mountain} label="Terrain" active={base === 'terrain'} onPress={() => onBaseChange('terrain')}
                tint={colors.greenBg} iconColor={colors.greenText} />
            </View>

            <Pressable
              style={styles.check}
              onPress={() => onLabelsChange(!labels)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: labels }}
              accessibilityLabel="Labels"
            >
              <View style={[styles.checkBox, labels && styles.checkBoxOn]}>
                {labels && <Check size={14} color={colors.white} />}
              </View>
              <Text style={styles.checkText}>Labels</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingBottom: 24 },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  tile: { alignItems: 'center', width: 88, paddingVertical: 6 },
  tileBox: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  tileBoxActive: { borderColor: colors.brand },
  tileLabel: { marginTop: 6, fontSize: 12, color: colors.muted2, fontWeight: '500' },
  tileLabelActive: { color: colors.brand, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  section: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', marginTop: 16, paddingVertical: 6, paddingHorizontal: 8 },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkText: { fontSize: 14, color: colors.ink },
});
