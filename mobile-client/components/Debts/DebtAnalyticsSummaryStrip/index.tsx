import React from "react";
import { Text, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import type { DebtAnalyticsSummaryStripProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

export default function DebtAnalyticsSummaryStrip({ currency, paidTotal, total, totalMonthly }: DebtAnalyticsSummaryStripProps) {
  const { t } = useAppTranslation();
  return (
    <View style={s.summaryRow}>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>{t("debts.analytics.remaining")}</Text>
        <Text style={[s.summaryVal, { color: T.red }]}>{fmt(total, currency)}</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>{t("debts.analytics.monthly")}</Text>
        <Text style={[s.summaryVal, { color: T.orange }]}>{fmt(totalMonthly, currency)}</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={s.summaryLbl}>{t("debts.analytics.paidOff")}</Text>
        <Text style={[s.summaryVal, { color: T.green }]}>{fmt(paidTotal, currency)}</Text>
      </View>
    </View>
  );
}
