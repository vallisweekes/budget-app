import React from "react";
import { Text, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { payoffDateLabel } from "@/lib/helpers/debtAnalytics";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";
import type { DebtAnalyticsStat } from "@/types/DebtAnalyticsScreen.types";

type Props = {
  currency: string;
  items: DebtAnalyticsStat[];
};

export default function DebtAnalyticsProgressList({ currency, items }: Props) {
  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>Progress</Text>
      {items.map((item, index) => (
        <View key={item.debt.id} style={[s.debtRow, index > 0 && s.debtRowBorder]}>
          <View style={[s.debtColorBar, { backgroundColor: item.color }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={s.debtRowTop}>
              <Text style={s.debtName} numberOfLines={1}>{item.debt.displayTitle ?? item.debt.name}</Text>
              <Text style={[s.debtBalance, { color: item.color }]}>{fmt(item.debt.currentBalance, currency)}</Text>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${Math.max(item.pctPaid, 2)}%` as `${number}%`, backgroundColor: item.color }]} />
            </View>
            <View style={s.debtRowMeta}>
              <Text style={s.debtMeta}>{item.pctPaid.toFixed(0)}% paid</Text>
              {item.debt.interestRate ? <Text style={s.debtMeta}>{item.debt.interestRate}% APR</Text> : null}
              <Text style={[s.debtMeta, { color: T.green }]}>Free {payoffDateLabel(item.months)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
