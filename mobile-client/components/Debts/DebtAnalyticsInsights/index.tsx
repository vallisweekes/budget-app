import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppLocale, useAppTranslation } from "@/hooks";
import type { DebtAnalyticsInsightsProps } from "@/types";
import { payoffDateLabel } from "@/lib/helpers/debtAnalytics";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

export default function DebtAnalyticsInsights({ earliest, highestAPR, latest }: DebtAnalyticsInsightsProps) {
  const { locale } = useAppLocale();
  const { t } = useAppTranslation();
  return (
    <>
      <View style={s.chipRow}>
        {earliest ? (
          <View style={[s.chip, { borderColor: T.green + "55" }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={T.green} />
            <View style={{ flex: 1 }}>
              <Text style={s.chipLbl}>{t("debts.analytics.clearsFirst")}</Text>
              <Text style={s.chipVal} numberOfLines={1}>{earliest.debt.displayTitle ?? earliest.debt.name}</Text>
              <Text style={[s.chipSub, { color: T.green }]}>{payoffDateLabel(earliest.months, locale)}</Text>
            </View>
          </View>
        ) : null}
        {latest ? (
          <View style={[s.chip, { borderColor: T.orange + "55" }]}>
            <Ionicons name="hourglass-outline" size={18} color={T.orange} />
            <View style={{ flex: 1 }}>
              <Text style={s.chipLbl}>{t("debts.analytics.lastToClear")}</Text>
              <Text style={s.chipVal} numberOfLines={1}>{latest.debt.displayTitle ?? latest.debt.name}</Text>
              <Text style={[s.chipSub, { color: T.orange }]}>{payoffDateLabel(latest.months, locale)} · {t("debts.projection.shortMonths", { count: latest.months })}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {highestAPR ? (
        <View style={[s.chip, { borderColor: T.red + "44" }]}>
          <Ionicons name="flame-outline" size={18} color={T.red} />
          <View style={{ flex: 1 }}>
            <Text style={s.chipLbl}>{t("debts.analytics.highestInterest")}</Text>
            <Text style={s.chipVal} numberOfLines={1}>{highestAPR.displayTitle ?? highestAPR.name}</Text>
            <Text style={[s.chipSub, { color: T.red }]}>{highestAPR.interestRate}% APR - {t("debts.analytics.payThisDownFirst")}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
