import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";

import SettingsDebtGroups from "@/components/Settings/SettingsDebtGroups";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import { asMoneyInput } from "@/lib/helpers/settings";
import type { SettingsMoneyCardsViewProps } from "@/types/components/settings/SettingsMoneyCardsView.types";

function toNumber(value: string | null | undefined): number {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function resolveCardAvailableAmount(currentBalance: number, creditLimit: number): number {
  if (creditLimit <= 0) return 0;
  return Math.max(creditLimit - currentBalance, 0);
}

export default function SettingsMoneyCardsView({ currency, creditCardGroups, storeCardGroups, onAddDebt, onOpenDebtEditor }: SettingsMoneyCardsViewProps) {
  const { t } = useAppTranslation();
  const cardsSummary = useMemo(() => {
    const debts = [...creditCardGroups, ...storeCardGroups].flatMap((group) => group.items);
    const debtsWithLimits = debts.filter((debt) => toNumber(debt.creditLimit) > 0);
    const limit = debtsWithLimits.reduce((sum, debt) => sum + toNumber(debt.creditLimit), 0);
    const available = debtsWithLimits.reduce((sum, debt) => {
      const creditLimit = toNumber(debt.creditLimit);
      const currentBalance = toNumber(debt.currentBalance);
      return sum + resolveCardAvailableAmount(currentBalance, creditLimit);
    }, 0);
    const outstanding = Math.max(limit - available, 0);
    const utilizationPct = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;

    return {
      available,
      hasChart: limit > 0,
      limit,
      limitedCardCount: debtsWithLimits.length,
      outstanding,
      utilizationPct,
    };
  }, [creditCardGroups, storeCardGroups]);

  return (
    <View style={styles.plainSavingsBlock}>
      <View>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>{t("settings.cards.creditCards")}</Text>
          <Pressable onPress={onAddDebt} style={styles.addCardBtn}>
            <Ionicons name="add" size={16} color={T.onAccent} />
            <Text style={styles.addCardBtnText}>{t("settings.cards.card")}</Text>
          </Pressable>
        </View>
        {cardsSummary.hasChart ? (
          <View style={styles.cardsSummaryCard}>
            <View style={styles.cardsSummaryHeader}>
              <View style={styles.cardsSummaryCopy}>
                <Text style={styles.cardsSummaryEyebrow}>{t("settings.cards.overview")}</Text>
                <Text style={styles.cardsSummaryPrimaryValue}>{currency}{asMoneyInput(String(cardsSummary.available)) || "0"}</Text>
                <Text style={styles.cardsSummaryPrimaryLabel}>{t("settings.cards.availableToSpend")}</Text>
                <Text style={styles.cardsSummaryUtilisation}>{cardsSummary.utilizationPct}% {t("settings.cards.utilisation").toLowerCase()}</Text>
              </View>

              <PieChart
                data={[
                  { value: Math.max(cardsSummary.outstanding, 0.0001), color: "#e25c5c" },
                  { value: Math.max(cardsSummary.available, 0.0001), color: "#3ec97e" },
                ]}
                donut
                radius={58}
                innerRadius={40}
                innerCircleColor={styles.cardsSummaryCard.backgroundColor as string}
                strokeWidth={2}
                strokeColor={styles.cardsSummaryCard.backgroundColor as string}
                showText={false}
                focusOnPress={false}
                isAnimated
                animationDuration={500}
                centerLabelComponent={() => (
                  <View style={styles.cardsSummaryChartCenter}>
                    <Text style={styles.cardsSummaryChartLabel}>Total</Text>
                    <Text style={styles.cardsSummaryChartValue}>{currency}{asMoneyInput(String(cardsSummary.limit)) || "0"}</Text>
                  </View>
                )}
              />
            </View>

            <View style={styles.cardsSummaryLegend}>
              <View style={styles.cardsSummaryLegendRow}>
                <View style={[styles.cardsSummaryLegendDot, { backgroundColor: "#3ec97e" }]} />
                <Text style={styles.cardsSummaryLegendLabel}>{t("settings.cards.availableToSpend")}</Text>
                <Text style={styles.cardsSummaryLegendValue}>{currency}{asMoneyInput(String(cardsSummary.available)) || "0"}</Text>
              </View>
              <View style={styles.cardsSummaryLegendRow}>
                <View style={[styles.cardsSummaryLegendDot, { backgroundColor: "#e25c5c" }]} />
                <Text style={styles.cardsSummaryLegendLabel}>{t("settings.cards.outstandingBalance")}</Text>
                <Text style={styles.cardsSummaryLegendValue}>{currency}{asMoneyInput(String(cardsSummary.outstanding)) || "0"}</Text>
              </View>
            </View>

            <View style={styles.cardsSummaryStatsRow}>
              <View style={styles.cardsSummaryStat}>
                <Text style={styles.cardsSummaryStatLabel}>{t("settings.cards.outstandingBalance")}</Text>
                <Text style={styles.cardsSummaryStatValue}>{currency}{asMoneyInput(String(cardsSummary.outstanding)) || "0"}</Text>
              </View>
              <View style={styles.cardsSummaryStat}>
                <Text style={styles.cardsSummaryStatLabel}>{t("debts.add.creditLimit")}</Text>
                <Text style={styles.cardsSummaryStatValue}>{currency}{asMoneyInput(String(cardsSummary.limit)) || "0"}</Text>
              </View>
            </View>

            <Text style={styles.cardsSummaryFootnote}>{t("settings.cards.basedOnCards", { count: cardsSummary.limitedCardCount })}</Text>
          </View>
        ) : null}
        {creditCardGroups.length === 0 ? (
          <Text style={styles.muted}>{t("settings.cards.noCreditCards")}</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={creditCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>

      <View style={styles.moneySectionCard}>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>{t("settings.cards.storeCards")}</Text>
        </View>
        {storeCardGroups.length === 0 ? (
          <Text style={styles.muted}>{t("settings.cards.noStoreCards")}</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={storeCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>
    </View>
  );
}
