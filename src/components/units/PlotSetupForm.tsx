/**
 * Blocks × plot-number-range form that produces a plot UnitSetup.
 *
 * The plot twin of UnitSetupForm. Controlled and stateless for the same reason
 * that one is: the Add Project screen (setup sent with the create call) and the
 * detail sheet's Setup/Edit Plots (sent to PUT /projects/:id/units) both render
 * it. Inputs are kept as strings in the draft so a half-typed number does not
 * snap to 0; plotDraftToSetup converts on submit.
 *
 * It is a separate component rather than a mode flag on UnitSetupForm because
 * nothing on the two forms lines up: a block has a number RANGE instead of
 * floors × units-per-floor, there is no BHK on land, and the flat form is the
 * one Skyline's 44 live units go through — a shared component would put that
 * path one typo away from every plot change.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash2 } from '../../icons';
import { colors, radius } from '../../theme';
import type { UnitSetup } from '../../lib/api';
import { MAX_BLOCKS, previewUnitSetup } from '../../lib/units';

export interface PlotSetupDraft {
  blocks: { name: string; from: string; to: string }[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Mirrors the server's MAX_TOWER_NAME, which block names share. Kept as a
// literal here like UnitSetupForm's 10, because units.ts does not export it.
const MAX_BLOCK_NAME = 10;

export function emptyPlotDraft(): PlotSetupDraft {
  // ONE UNNAMED block, unlike the flat form's auto-'A': "120 plots, no blocks"
  // is the common layout on a single-phase plotting, and an auto-named block
  // would make every such project ship labels like 'A-1' the brochure does not
  // use. Naming is one keystroke away for the projects that need it.
  return { blocks: [{ name: '', from: '', to: '' }] };
}

export function plotDraftFromSetup(s: UnitSetup): PlotSetupDraft {
  // UnitSetup is a tagged union; a flat setup has no `blocks` at all, so it
  // opens the empty draft rather than being half-read into a block with NaN
  // bounds. The caller (setupFromUnits + unitMode) normally prevents this.
  if (s.mode !== 'plot') return emptyPlotDraft();
  if (!s.blocks.length) return emptyPlotDraft();
  return { blocks: s.blocks.map(b => ({ name: b.name, from: String(b.from), to: String(b.to) })) };
}

export function plotDraftToSetup(d: PlotSetupDraft): UnitSetup {
  // Number('') is 0 and Number('4.5') is 4.5 — both are rejected by
  // previewUnitSetup / the server, which is what we want instead of rounding.
  return {
    mode: 'plot',
    blocks: d.blocks.map(b => ({ name: b.name.trim(), from: Number(b.from), to: Number(b.to) })),
  };
}

interface Props {
  value: PlotSetupDraft;
  onChange: (next: PlotSetupDraft) => void;
}

export function PlotSetupForm({ value, onChange, accent = colors.brand }: Props & { accent?: string }) {
  const preview = previewUnitSetup(plotDraftToSetup(value));
  const setBlock = (i: number, patch: Partial<PlotSetupDraft['blocks'][number]>) =>
    onChange({ ...value, blocks: value.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const addBlock = () => {
    const used = new Set(value.blocks.map(b => b.name.trim().toUpperCase()).filter(Boolean));
    // Only auto-name when a block is ALREADY named. On a layout that started
    // unnamed, adding a second block almost always means "now I do have blocks",
    // but guessing 'A' for it would silently rename nothing and leave the first
    // one bare — previewUnitSetup allows exactly one unnamed block, so the user
    // names them in the order they choose.
    const next = used.size ? [...LETTERS].find(l => !used.has(l)) || '' : '';
    // The range is left empty rather than copied from the previous block (which
    // is what the flat form does with floors × units-per-floor): identical
    // towers are the norm, identical plot RANGES are impossible — two blocks
    // sharing 1-40 is either a typo or a label collision.
    onChange({ ...value, blocks: [...value.blocks, { name: next, from: '', to: '' }] });
  };
  const removeBlock = (i: number) => onChange({ ...value, blocks: value.blocks.filter((_, j) => j !== i) });
  const digits = (v: string) => v.replace(/[^0-9]/g, '');

  return (
    <View style={f.wrap}>
      <View style={f.headRow}>
        <Text style={[f.col, f.colName, f.head]}>Block</Text>
        <Text style={[f.col, f.head]}>First plot</Text>
        <Text style={[f.col, f.head]}>Last plot</Text>
        <View style={{ width: 28 }} />
      </View>

      {value.blocks.map((b, i) => (
        <View key={i} style={f.row}>
          <TextInput
            style={[f.input, f.colName]}
            value={b.name}
            onChangeText={v => setBlock(i, { name: v.slice(0, MAX_BLOCK_NAME) })}
            placeholder="(no block)"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            accessibilityLabel={`Block ${i + 1} name, optional`}
          />
          <TextInput
            style={[f.input, f.col]}
            value={b.from}
            onChangeText={v => setBlock(i, { from: digits(v) })}
            placeholder="1"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            accessibilityLabel={`Block ${b.name || i + 1} first plot number`}
          />
          <TextInput
            style={[f.input, f.col]}
            value={b.to}
            onChangeText={v => setBlock(i, { to: digits(v) })}
            placeholder="40"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            accessibilityLabel={`Block ${b.name || i + 1} last plot number`}
          />
          <Pressable
            onPress={() => removeBlock(i)}
            disabled={value.blocks.length <= 1}
            hitSlop={6}
            style={[f.iconBtn, value.blocks.length <= 1 && { opacity: 0.3 }]}
            accessibilityRole="button"
            accessibilityLabel={`Remove block ${b.name || i + 1}`}
          >
            <Trash2 size={16} color={colors.red} />
          </Pressable>
        </View>
      ))}

      {value.blocks.length < MAX_BLOCKS ? (
        <Pressable onPress={addBlock} style={f.addBtn} accessibilityRole="button" accessibilityLabel="Add block">
          <Plus size={14} color={accent} />
          <Text style={[f.addText, { color: accent }]}>Add Block</Text>
        </Pressable>
      ) : null}

      {preview.error ? (
        <Text style={f.error}>{preview.error}</Text>
      ) : (
        <Text style={f.preview}>Total {preview.total} plots · {preview.first} … {preview.last}</Text>
      )}
    </View>
  );
}

export default PlotSetupForm;

// Same shape as UnitSetupForm's `f` on purpose — the two forms sit in the same
// box in both call sites, so a divergent input height or gap would read as a
// bug. Plain StyleSheet with src/theme.ts tokens; no NativeWind.
const f = StyleSheet.create({
  wrap: { gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head: { fontSize: 12, fontWeight: '600', color: colors.muted2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: { flex: 1 },
  colName: { flex: 0.8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  iconBtn: { width: 28, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  addText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  preview: { fontSize: 12, fontWeight: '600', color: colors.greenText },
  error: { fontSize: 12, fontWeight: '600', color: colors.redText },
});
