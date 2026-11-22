/**
 * GitHub-contributions-style unit grid for a flat or a plot project.
 *
 * One small square per unit, coloured by status. Tapping a cell selects it and
 * shows its details in a strip under the grid. Editors also get the four status
 * chips in that strip — kept inline instead of a second Modal, because this grid
 * lives inside the property detail Modal and stacked Modals are unreliable on
 * Android.
 *
 * It was FLAT-ONLY until land projects got an inventory: one row per floor (top
 * floor first), one block per tower, inside a horizontal ScrollView, and a
 * selection strip that always printed "Floor {n}". A plot has no floor and no
 * tower, so that layout gave every plot project a single nameless tower of
 * "Floor 0" cells. The plot branch below is therefore additive — the flat path
 * is untouched, which is how Skyline's live units stay byte-identical — and the
 * mode is read from the DATA (unitKindOf on the first unit) rather than from a
 * new prop, so both call sites and the read-only drawer grid keep working.
 *
 * Area / facing / corner in the plot strip are DISPLAY-ONLY: the server has no
 * per-unit attribute endpoint yet, only the status PATCH, so there is nothing to
 * send even if the strip offered an editor.
 */
import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import type { ProjectUnit, UnitStatus } from '../../lib/api';
import { PLOT_FACING_OPTIONS, UNIT_STATUS, UNIT_STATUSES, groupPlotUnits, groupUnits, statusMeta, summarizeUnits, unitKindOf } from '../../lib/units';

const CELL = 18;
const GAP = 4;

interface Props {
  units: ProjectUnit[];
  canEdit: boolean;
  /** Resolves when the server accepted the change; rejects to keep the old status. */
  onChangeStatus?: (unit: ProjectUnit, status: UnitStatus) => Promise<void>;
  busyUnitId?: string | null;
}

/**
 * Print a stored facing in the Title-Case the create form offers.
 *
 * Needed because the value is not guaranteed to come from PLOT_FACING_OPTIONS:
 * the web dashboard and older imports write 'east' / 'NORTH-EAST', and there is
 * no normalising migration (it is a display-only field). An unrecognised value
 * is shown raw rather than dropped — a wrong-cased answer still beats no answer.
 */
function canonicalFacing(raw: string): string {
  const key = raw.trim().toLowerCase();
  return PLOT_FACING_OPTIONS.find(o => o.toLowerCase() === key) || raw;
}

function UnitGridInner({ units, canEdit, onChangeStatus, busyUnitId }: Props) {
  // First non-hole unit decides the mode. One project is one kind — the server
  // refuses a mixed-kind save with a 409 — so a single probe is enough, and a
  // missing `kind` reads as flat exactly as it does on the server.
  const mode = useMemo(() => unitKindOf((units || []).find(u => u)), [units]);
  const towers = useMemo(() => (mode === 'plot' ? [] : groupUnits(units)), [units, mode]);
  const blocks = useMemo(() => (mode === 'plot' ? groupPlotUnits(units) : []), [units, mode]);
  const counts = useMemo(() => summarizeUnits(units), [units]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Look the selection up in the live array so a socket update re-renders the strip.
  const selected = useMemo(() => units.find(u => u._id === selectedId) || null, [units, selectedId]);

  if (!units.length) return null;

  const legend: { status: UnitStatus; n: number }[] = [
    { status: 'available', n: counts.available },
    { status: 'booked', n: counts.booked },
    { status: 'sold', n: counts.sold },
    { status: 'on-hold', n: counts.onHold },
  ];

  return (
    <View style={g.wrap}>
      <View style={g.headRow}>
        <Text style={g.title}>{mode === 'plot' ? 'Plot Availability' : 'Unit Availability'}</Text>
        <Text style={g.total}>{counts.available}/{counts.total} vacant</Text>
      </View>

      <View style={g.legend}>
        {legend.map(l => (
          <View key={l.status} style={g.legendItem}>
            <View style={[g.legendDot, { backgroundColor: UNIT_STATUS[l.status].color }]} />
            <Text style={g.legendText}>{UNIT_STATUS[l.status].label} {l.n}</Text>
          </View>
        ))}
      </View>

      {blocks.map(b => (
        <View key={b.block} style={g.tower}>
          {/* Omitted entirely for the unnamed block — "120 plots, no blocks" is
              the common layout and a bare "Block" heading would say nothing. */}
          {b.block ? <Text style={g.towerName}>Block {b.block}</Text> : null}
          {/* Wrapping grid, not the flat path's horizontal ScrollView: plots
              have no floor axis, so 120 equal cells would otherwise become one
              120-wide scroll strip the user has to drag through to find a plot. */}
          <View style={g.plotWrap}>
            {b.units.map(u => {
              const meta = statusMeta(u.status);
              const isSel = u._id === selectedId;
              return (
                <Pressable
                  key={u._id}
                  onPress={() => setSelectedId(isSel ? null : u._id)}
                  hitSlop={2}
                  style={[g.cell, { backgroundColor: meta.color }, isSel && g.cellSel]}
                  accessibilityRole="button"
                  accessibilityLabel={`Plot ${u.plotNumber || u.label}, ${meta.label}`}
                  accessibilityState={{ selected: isSel }}
                />
              );
            })}
          </View>
        </View>
      ))}

      {towers.map(t => (
        <View key={t.tower} style={g.tower}>
          <Text style={g.towerName}>Tower {t.tower}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {t.floors.map(f => (
                <View key={f.floor} style={g.floorRow}>
                  <Text style={g.floorLabel}>{f.floor}</Text>
                  {f.units.map(u => {
                    const meta = statusMeta(u.status);
                    const isSel = u._id === selectedId;
                    return (
                      <Pressable
                        key={u._id}
                        onPress={() => setSelectedId(isSel ? null : u._id)}
                        hitSlop={2}
                        style={[g.cell, { backgroundColor: meta.color }, isSel && g.cellSel]}
                        accessibilityRole="button"
                        accessibilityLabel={`${u.label}, ${meta.label}`}
                        accessibilityState={{ selected: isSel }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ))}

      {selected ? (
        <View style={g.detail}>
          <View style={g.detailHead}>
            <Text style={g.detailLabel}>{selected.label}</Text>
            {mode === 'plot' ? (
              <>
                {/* Area is the one plot field that is genuinely undefined when the
                    server never wrote it (setup writes no areaSqFt key), so it
                    prints an em-dash instead of "0 sqft" — a measured zero does
                    not exist. BHK and Floor are deliberately absent: both are
                    ''/0 on a plot unit. */}
                <Text style={g.detailSub}>· {selected.areaSqFt !== undefined ? `${selected.areaSqFt} sqft` : 'Area —'}</Text>
                {selected.facing ? <Text style={g.detailSub}>· {canonicalFacing(selected.facing)}</Text> : null}
                {selected.cornerPlot ? <Text style={g.detailSub}>· Corner</Text> : null}
              </>
            ) : (
              <>
                {selected.bhk ? <Text style={g.detailSub}>· {selected.bhk}</Text> : null}
                <Text style={g.detailSub}>· Floor {selected.floor}</Text>
              </>
            )}
            <View style={{ flex: 1 }} />
            <View style={[g.pill, { backgroundColor: statusMeta(selected.status).color }]}>
              <Text style={g.pillText}>{statusMeta(selected.status).label}</Text>
            </View>
          </View>

          {canEdit && onChangeStatus ? (
            <View style={g.chips}>
              {UNIT_STATUSES.map(s => {
                const active = selected.status === s;
                const busy = busyUnitId === selected._id;
                return (
                  <Pressable
                    key={s}
                    disabled={active || busy}
                    onPress={() => { onChangeStatus(selected, s).catch(() => {}); }}
                    style={[g.chip, active && { backgroundColor: UNIT_STATUS[s].color, borderColor: UNIT_STATUS[s].color }, busy && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${selected.label} ${UNIT_STATUS[s].label}`}
                    accessibilityState={{ selected: active, disabled: active || busy }}
                  >
                    {!active ? <View style={[g.legendDot, { backgroundColor: UNIT_STATUS[s].color }]} /> : null}
                    <Text style={[g.chipText, active && { color: colors.white }]}>{UNIT_STATUS[s].label}</Text>
                  </Pressable>
                );
              })}
              {busyUnitId === selected._id ? <ActivityIndicator size="small" color={colors.brand} /> : null}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={g.hint}>{canEdit ? 'Tap a box to change its status' : 'Tap a box to see the unit'}</Text>
      )}
    </View>
  );
}

export const UnitGrid = memo(UnitGridInner);
export default UnitGrid;

const g = StyleSheet.create({
  wrap: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  total: { fontSize: 12, fontWeight: '600', color: colors.greenText },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.muted2 },
  tower: { gap: 4 },
  towerName: { fontSize: 12, fontWeight: '700', color: colors.muted2 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: GAP, marginBottom: GAP },
  plotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  floorLabel: { width: 22, fontSize: 10, color: colors.muted, textAlign: 'right', marginRight: 2 },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  cellSel: { borderWidth: 2, borderColor: colors.ink },
  detail: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  detailSub: { fontSize: 12, color: colors.muted2 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  hint: { fontSize: 11, color: colors.muted },
});
