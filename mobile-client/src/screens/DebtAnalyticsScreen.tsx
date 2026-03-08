import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DebtAnalyticsDonutChart from "@/components/Debts/DebtAnalyticsDonutChart";
import DebtAnalyticsInsights from "@/components/Debts/DebtAnalyticsInsights";
import DebtAnalyticsProgressList from "@/components/Debts/DebtAnalyticsProgressList";
import DebtAnalyticsSummaryStrip from "@/components/Debts/DebtAnalyticsSummaryStrip";
import DebtAnalyticsTimelineChart from "@/components/Debts/DebtAnalyticsTimelineChart";
import { useDebtAnalyticsScreenController } from "../lib/hooks/useDebtAnalyticsScreenController";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/screens/debtAnalytics/styles";

export default function DebtAnalyticsScreen() {
  const controller = useDebtAnalyticsScreenController();

  if (controller.loading) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>Loading analytics...</Text>
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
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: controller.topContentInset }]}>
        <DebtAnalyticsSummaryStrip
          currency={controller.currency}
          paidTotal={controller.paidTotal}
          total={controller.total}
          totalMonthly={controller.totalMonthly}
        />

        <View style={s.card}>
          <Text style={s.sectionTitle}>Debt Breakdown</Text>
          <Text style={s.sectionSub}>Proportion of your total debt</Text>
          <View style={{ marginTop: 14 }}>
            <DebtAnalyticsDonutChart
              debts={controller.activeDebts}
              colors={controller.colors}
              currency={controller.currency}
            />
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Payoff Timeline</Text>
          <Text style={s.sectionSub}>How long until each debt is cleared</Text>
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
