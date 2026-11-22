// Cost sheet rows for a quotation: charge lines, the optional discount row,
// agreement value, taxes and the grand total. Shared by the wizard's live
// preview (quotationCalc result) and the Meri Quotations detail sheet (server
// quotation), which have the same { lines, taxes, totals } shape.
//
// The discount row is driven by totals.discount > 0, not by the lines array
// (2=b): a blank or 0 discount must never print as a "₹0" row.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { QuotationLine, QuotationTotals } from '../../lib/api';
import { formatINR } from '../../lib/inr';
import { colors, spacing } from '../../theme';

export default function CostSheet({ lines, taxes, totals }: {
  lines: QuotationLine[];
  taxes: QuotationLine[];
  totals: QuotationTotals;
}) {
  return (
    <View style={s.wrap}>
      {lines.filter(l => l.key !== 'discount').map(l => (
        <Row key={l.key} label={l.label} amount={l.amount} />
      ))}
      {totals.discount > 0 && <Row label="Discount" amount={-totals.discount} green />}
      <Row label="Agreement value" amount={totals.agreementValue} bold divider />
      {taxes.map(t => <Row key={t.key} label={t.label} amount={t.amount} />)}
      <View style={s.grand}>
        <Text style={s.grandLabel}>Grand total</Text>
        <Text style={s.grandValue}>{formatINR(totals.grandTotal)}</Text>
      </View>
    </View>
  );
}

function Row({ label, amount, bold, divider, green }: { label: string; amount: number; bold?: boolean; divider?: boolean; green?: boolean }) {
  return (
    <View style={[s.row, divider && s.divider]}>
      <Text style={[s.label, bold && s.bold]} numberOfLines={2}>{label}</Text>
      <Text style={[s.amount, bold && s.bold, green && { color: colors.greenText }]}>{formatINR(amount)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  label: { flex: 1, fontSize: 12, color: colors.muted2 },
  amount: { fontSize: 12, fontWeight: '600', color: colors.ink },
  bold: { fontWeight: '800', color: colors.ink },
  grand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, marginTop: 2 },
  grandLabel: { fontSize: 14, fontWeight: '800', color: colors.ink },
  grandValue: { fontSize: 16, fontWeight: '800', color: colors.brand },
});
