import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AnalyticsDebtDistributionCard from "@/components/Analytics/AnalyticsDebtDistributionCard";
import AnalyticsInsightGrid from "@/components/Analytics/AnalyticsInsightGrid";
import AnalyticsOverviewCard from "@/components/Analytics/AnalyticsOverviewCard";
import AnalyticsTipsCard from "@/components/Analytics/AnalyticsTipsCard";
import { useAnalyticsScreenController } from "@/lib/hooks/useAnalyticsScreenController";
import type { RootStackScreenProps } from "@/navigation/types";
import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/screens/analytics/styles";

export default function AnalyticsScreen({ navigation }: RootStackScreenProps<"Analytics">) {
  const controller = useAnalyticsScreenController(navigation);

  if (controller.loading) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: controller.topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loading}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.error) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: controller.topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={42} color={T.textDim} />
          <Text style={s.error}>{controller.error}</Text>
          <Pressable onPress={controller.retry} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: controller.topHeaderOffset }]}
        refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.accent} />}
      >
        <AnalyticsInsightGrid rows={controller.insightRows} />
        <AnalyticsOverviewCard
          chartData={controller.chartData}
          chartSpacing={controller.chartSpacing}
          chartWidth={controller.chartWidth}
          currency={controller.currency}
          currentMonthLabel={controller.currentMonthLabel}
          expenseLine={controller.overviewExpenseLine}
          incomeLine={controller.overviewIncomeLine}
          onWrapWidthChange={controller.setOverviewWrapWidth}
          overviewMaxValue={controller.overviewMaxValue}
          overviewMode={controller.overviewMode}
          overviewWrapWidth={controller.overviewWrapWidth}
        />
        <AnalyticsTipsCard tips={controller.topTips} />
        <AnalyticsDebtDistributionCard
          currency={controller.currency}
          items={controller.debtDistribution}
          overviewMode={controller.overviewMode}
          title={controller.debtDistributionTitle}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
