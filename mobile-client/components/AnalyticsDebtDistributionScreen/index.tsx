import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import AnalyticsDebtDistributionCard from "@/components/Analytics/AnalyticsDebtDistributionCard";
import { useAnalyticsScreenController, useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsScreenProps } from "@/types";

export default function AnalyticsDebtDistributionScreen({ overviewMode }: AnalyticsScreenProps) {
  const { t } = useAppTranslation();
  const controller = useAnalyticsScreenController({ overviewMode: overviewMode ?? "year" });

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
          showsVerticalScrollIndicator={false}
        >
          <AnalyticsDebtDistributionCard
            currency={controller.currency}
            items={controller.debtDistribution}
            overviewMode={controller.overviewMode}
            title={controller.debtDistributionTitle}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
