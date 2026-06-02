import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AnalyticsInsightGrid from "@/components/Analytics/AnalyticsInsightGrid";
import AnalyticsNetWorthCard from "@/components/Analytics/AnalyticsNetWorthCard";
import AnalyticsOverviewCard from "@/components/Analytics/AnalyticsOverviewCard";
import AnalyticsTipsCard from "@/components/Analytics/AnalyticsTipsCard";
import { useAnalyticsScreenController, useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import type { AnalyticsOverviewMode, AnalyticsScreenProps } from "@/types";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";

export default function AnalyticsScreen({ overviewMode }: AnalyticsScreenProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const initialMode: AnalyticsOverviewMode = overviewMode ?? "year";
  const [selectedMode, setSelectedMode] = React.useState<AnalyticsOverviewMode>(initialMode);

  React.useEffect(() => {
    setSelectedMode(initialMode);
  }, [initialMode]);

  const controller = useAnalyticsScreenController({ overviewMode: selectedMode });

  if (controller.loading) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: controller.topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loading}>{t("analytics.loading")}</Text>
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
            <Text style={s.retryTxt}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <View style={s.screenShell}>
        <View pointerEvents="none" style={s.screenGlowPrimary} />
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: controller.topHeaderOffset }]}
          refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.modeSwitchWrap}>
            <Pressable
              onPress={() => setSelectedMode("month")}
              style={[s.modeSwitchChip, selectedMode === "month" && s.modeSwitchChipActive]}
              accessibilityRole="button"
              accessibilityLabel={t("tabs.month")}
            >
              <Text style={[s.modeSwitchChipText, selectedMode === "month" && s.modeSwitchChipTextActive]}>{t("tabs.month")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedMode("year")}
              style={[s.modeSwitchChip, selectedMode === "year" && s.modeSwitchChipActive]}
              accessibilityRole="button"
              accessibilityLabel={t("tabs.year")}
            >
              <Text style={[s.modeSwitchChipText, selectedMode === "year" && s.modeSwitchChipTextActive]}>{t("tabs.year")}</Text>
            </Pressable>
          </View>

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

          <AnalyticsNetWorthCard
            netWorth={controller.netWorth}
            totalAssets={controller.totalAssets}
            totalLiabilities={controller.totalLiabilities}
            trendValues={controller.netWorthTrendValues}
            trendLabels={controller.netWorthTrendLabels}
            currency={controller.currency}
          />

          <AnalyticsInsightGrid
            rows={controller.insightRows}
            onPressDebtCard={() => {
              router.push({
                pathname: "/analytics-debt-distribution",
                params: { overviewMode: selectedMode },
              });
            }}
          />
          <AnalyticsTipsCard tips={controller.topTips} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
