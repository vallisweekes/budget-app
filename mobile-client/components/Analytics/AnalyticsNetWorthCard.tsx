import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AnalyticsNetWorthCardProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";

type NetWorthTone = "positive" | "balanced" | "warning" | "negative" | "neutral";

type NetWorthProfile = {
  tone: NetWorthTone;
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  coverageText: string;
  debtText: string;
  badgeTextColor: string;
  badgeBackgroundColor: string;
  badgeBorderColor: string;
  valueColor: string;
};

function asPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.max(0, Math.round(value * 100))}%`;
}

function buildNetWorthProfile(totalAssets: number, totalLiabilities: number, netWorth: number): NetWorthProfile {
  const hasAssets = totalAssets > 0.0001;
  const hasLiabilities = totalLiabilities > 0.0001;
  const coverage = hasLiabilities ? Math.max(0, totalAssets) / Math.max(0, totalLiabilities) : null;
  const debtRatio = hasAssets ? totalLiabilities / totalAssets : null;

  if (!hasAssets && !hasLiabilities) {
    return {
      tone: "neutral",
      label: "Starting",
      subtitle: "Add balances and liabilities to start tracking your position.",
      icon: "compass-outline",
      coverageText: "Asset coverage --",
      debtText: "Debt ratio --",
      badgeTextColor: "#9aa3b8",
      badgeBackgroundColor: "rgba(154,163,184,0.14)",
      badgeBorderColor: "rgba(154,163,184,0.28)",
      valueColor: "#dfe6f3",
    };
  }

  if (!hasLiabilities && hasAssets) {
    return {
      tone: "positive",
      label: "Debt free",
      subtitle: "No liabilities are currently recorded against your assets.",
      icon: "shield-checkmark-outline",
      coverageText: "Asset coverage inf",
      debtText: "Debt ratio 0%",
      badgeTextColor: "#6ee4bd",
      badgeBackgroundColor: "rgba(81,219,168,0.16)",
      badgeBorderColor: "rgba(81,219,168,0.34)",
      valueColor: "#dfe6f3",
    };
  }

  if (netWorth < 0) {
    return {
      tone: "negative",
      label: "Leveraged",
      subtitle: "Liabilities are currently above total assets.",
      icon: "alert-circle-outline",
      coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
      debtText: `Debt ratio ${asPercent(debtRatio)}`,
      badgeTextColor: "#ff9da3",
      badgeBackgroundColor: "rgba(255,123,137,0.16)",
      badgeBorderColor: "rgba(255,123,137,0.40)",
      valueColor: "#ff9ca2",
    };
  }

  if ((coverage ?? 0) >= 1.4) {
    return {
      tone: "positive",
      label: "Healthy",
      subtitle: "Assets are comfortably ahead of liabilities.",
      icon: "trending-up-outline",
      coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
      debtText: `Debt ratio ${asPercent(debtRatio)}`,
      badgeTextColor: "#6ee4bd",
      badgeBackgroundColor: "rgba(81,219,168,0.16)",
      badgeBorderColor: "rgba(81,219,168,0.34)",
      valueColor: "#dfe6f3",
    };
  }

  return {
    tone: "warning",
    label: "Tight",
    subtitle: "Liabilities are close to total asset value.",
    icon: "warning-outline",
    coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
    debtText: `Debt ratio ${asPercent(debtRatio)}`,
    badgeTextColor: "#ffc08a",
    badgeBackgroundColor: "rgba(255,176,120,0.16)",
    badgeBorderColor: "rgba(255,176,120,0.36)",
    valueColor: "#dfe6f3",
  };
}

export default function AnalyticsNetWorthCard({
  currency,
  netWorth,
  totalAssets,
  totalLiabilities,
  trendValues: _trendValues,
  trendLabels: _trendLabels,
}: AnalyticsNetWorthCardProps) {
  const profile = React.useMemo(
    () => buildNetWorthProfile(totalAssets, totalLiabilities, netWorth),
    [netWorth, totalAssets, totalLiabilities],
  );
  const split = React.useMemo(() => {
    const assets = Math.max(0, totalAssets);
    const liabilities = Math.max(0, totalLiabilities);
    const total = assets + liabilities;
    if (total <= 0) {
      return { assetsFlex: 1, liabilitiesFlex: 0 };
    }

    return { assetsFlex: assets, liabilitiesFlex: liabilities };
  }, [totalAssets, totalLiabilities]);

  return (
    <View style={s.netWorthTrendCard}>
      <View style={s.netWorthTrendHeaderRow}>
        <Text style={s.netWorthTrendEyebrow}>Net Worth Position</Text>
        <View
          style={[
            s.netWorthTrendStatusBadge,
            {
              backgroundColor: profile.badgeBackgroundColor,
              borderColor: profile.badgeBorderColor,
            },
          ]}
        >
          <Ionicons name={profile.icon} size={12} color={profile.badgeTextColor} />
          <Text style={[s.netWorthTrendStatusBadgeText, { color: profile.badgeTextColor }]}>{profile.label}</Text>
        </View>
      </View>

      <Text style={[s.netWorthTrendValue, { color: profile.valueColor }]}>
        {fmt(netWorth, currency)}
      </Text>
      <Text style={s.netWorthTrendSubtitle}>{profile.subtitle}</Text>

      <View style={s.netWorthTrendSplitTrack}>
        <View style={[s.netWorthTrendSplitAssets, { flex: split.assetsFlex }]} />
        {split.liabilitiesFlex > 0 ? <View style={[s.netWorthTrendSplitLiabilities, { flex: split.liabilitiesFlex }]} /> : null}
      </View>

      <View style={s.netWorthTrendMetaRow}>
        <Text style={[s.netWorthTrendMetaText, s.netWorthTrendMetaTextAssets]}>Assets {fmt(totalAssets, currency)}</Text>
        <Text style={s.netWorthTrendMetaDot}>•</Text>
        <Text style={[s.netWorthTrendMetaText, s.netWorthTrendMetaTextLiabilities]}>Liabilities {fmt(totalLiabilities, currency)}</Text>
      </View>

      <View style={s.netWorthTrendSignalsRow}>
        <Text style={[s.netWorthTrendSignalText, s.netWorthTrendSignalTextAssets]}>{profile.coverageText}</Text>
        <Text style={[s.netWorthTrendSignalText, s.netWorthTrendSignalTextLiabilities]}>{profile.debtText}</Text>
      </View>
    </View>
  );
}