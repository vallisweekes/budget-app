import React from "react";
import { Text, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

type Props = {
  currency: string;
  paidTotal: number;
  total: number;
  totalMonthly: number;
};

export default function DebtAnalyticsSummaryStrip({ currency, paidTotal, total, totalMonthly }: Props) {
  return (
    <View style={s.summaryRow}>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>REMAINING</Text>
        <Text style={[s.summaryVal, { color: T.red }]}>{fmt(total, currency)}</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>MONTHLY</Text>
        <Text style={[s.summaryVal, { color: T.orange }]}>{fmt(totalMonthly, currency)}</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>PAID OFF</Text>
        <Text style={[s.summaryVal, { color: T.green }]}>{fmt(paidTotal, currency)}</Text>
      </View>
    </View>
  );
}
