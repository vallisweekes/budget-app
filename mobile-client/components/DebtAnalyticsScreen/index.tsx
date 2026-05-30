import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DebtAnalyticsDonutChart from "@/components/Debts/DebtAnalyticsDonutChart";
import DebtAnalyticsInsights from "@/components/Debts/DebtAnalyticsInsights";
import DebtAnalyticsProgressList from "@/components/Debts/DebtAnalyticsProgressList";
import DebtAnalyticsSummaryStrip from "@/components/Debts/DebtAnalyticsSummaryStrip";
import DebtAnalyticsTimelineChart from "@/components/Debts/DebtAnalyticsTimelineChart";
import { useAppTranslation, useDebtAnalyticsScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

export default function DebtAnalyticsScreen() {
  const { t } = useAppTranslation();
  const controller = useDebtAnalyticsScreenController();

  if (controller.loading) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>{t("debts.analytics.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.error) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>{controller.error}</Text>
          <Pressable onPress={() => { void controller.load(); }} style={s.retryBtn}>
            <Text style={s.retryTxt}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: controller.topContentInset }]}>
        <View style={s.heroSection}>
          <Text style={s.heroTitle}>{t("debts.analytics.breakdownTitle")}</Text>
          <Text style={s.heroSub}>{t("debts.analytics.breakdownSub")}</Text>
          <DebtAnalyticsDonutChart
            debts={controller.activeDebts}
            colors={controller.colors}
            currency={controller.currency}
          />
        </View>

        <DebtAnalyticsSummaryStrip
          currency={controller.currency}
          paidTotal={controller.paidTotal}
          total={controller.total}
          totalMonthly={controller.totalMonthly}
        />

        <View style={s.card}>
          <Text style={s.sectionTitle}>{t("debts.analytics.payoffTimelineTitle")}</Text>
          <Text style={s.sectionSub}>{t("debts.analytics.payoffTimelineSub")}</Text>
          <View style={{ marginTop: 16 }}>
            <DebtAnalyticsTimelineChart
              items={controller.ganttItems}
              maxMonths={controller.maxMonths}
            />
          </View>
        </View>

        <DebtAnalyticsInsights
          earliest={controller.earliest}
          highestAPR={controller.highestAPR}
          latest={controller.latest}
        />

        <DebtAnalyticsProgressList
          currency={controller.currency}
          items={controller.debtStats}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
