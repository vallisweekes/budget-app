import { useMemo, type ComponentProps } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DashboardNetWorthSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { styles } from "@/components/DashboardScreen/style";
import { T } from "@/lib/theme";

type NetWorthTone = "positive" | "balanced" | "warning" | "negative" | "neutral";

type NetWorthProfile = {
  tone: NetWorthTone;
  label: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  coverageText: string;
  debtText: string;
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
      label: "Starting point",
      subtitle: "Add balances and debts to track your position.",
      icon: "compass-outline",
      coverageText: "Asset coverage --",
      debtText: "Debt ratio --",
    };
  }

  if (!hasLiabilities && hasAssets) {
    return {
      tone: "positive",
      label: "Debt free",
      subtitle: "No liabilities against your current assets.",
      icon: "shield-checkmark-outline",
      coverageText: "Asset coverage inf",
      debtText: "Debt ratio 0%",
    };
  }

  if (netWorth < 0) {
    return {
      tone: "negative",
      label: "Leveraged",
      subtitle: "Liabilities are above your total assets.",
      icon: "alert-circle-outline",
      coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
      debtText: `Debt ratio ${asPercent(debtRatio)}`,
    };
  }

  if ((coverage ?? 0) >= 2.5) {
    return {
      tone: "positive",
      label: "Strong coverage",
      subtitle: "Assets comfortably cover liabilities.",
      icon: "trending-up-outline",
      coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
      debtText: `Debt ratio ${asPercent(debtRatio)}`,
    };
  }

  if ((coverage ?? 0) >= 1.3) {
    return {
      tone: "balanced",
      label: "Balanced",
      subtitle: "Assets are ahead of liabilities.",
      icon: "analytics-outline",
      coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
      debtText: `Debt ratio ${asPercent(debtRatio)}`,
    };
  }

  return {
    tone: "warning",
    label: "Tight coverage",
    subtitle: "Liabilities are close to asset value.",
    icon: "warning-outline",
    coverageText: `Asset coverage ${(coverage ?? 0).toFixed(2)}x`,
    debtText: `Debt ratio ${asPercent(debtRatio)}`,
  };
}

export default function DashboardNetWorthSection({
  netWorth,
  totalAssets,
  totalLiabilities,
  currency,
}: DashboardNetWorthSectionProps) {
  const profile = useMemo(
    () => buildNetWorthProfile(totalAssets, totalLiabilities, netWorth),
    [netWorth, totalAssets, totalLiabilities],
  );

  const split = useMemo(() => {
    const assets = Math.max(0, totalAssets);
    const liabilities = Math.max(0, totalLiabilities);
    const total = assets + liabilities;
    if (total <= 0) return { assetsFlex: 1, liabilitiesFlex: 0 };
    return { assetsFlex: assets, liabilitiesFlex: liabilities };
  }, [totalAssets, totalLiabilities]);

  const badgeToneStyle =
    profile.tone === "positive"
      ? styles.netWorthBadgePositive
      : profile.tone === "balanced"
        ? styles.netWorthBadgeBalanced
        : profile.tone === "warning"
          ? styles.netWorthBadgeWarning
          : profile.tone === "negative"
            ? styles.netWorthBadgeNegative
            : styles.netWorthBadgeNeutral;

  const badgeToneTextStyle =
    profile.tone === "positive"
      ? styles.netWorthBadgeTextPositive
      : profile.tone === "balanced"
        ? styles.netWorthBadgeTextBalanced
        : profile.tone === "warning"
          ? styles.netWorthBadgeTextWarning
          : profile.tone === "negative"
            ? styles.netWorthBadgeTextNegative
            : styles.netWorthBadgeTextNeutral;

  const badgeIconColor =
    profile.tone === "positive"
      ? "#62e0b4"
      : profile.tone === "balanced"
        ? T.accent
        : profile.tone === "warning"
          ? "#f6b35f"
          : profile.tone === "negative"
            ? "#ff8f8f"
            : T.textMuted;

  return (
    <View style={styles.netWorthCard}>
      <View style={styles.netWorthHeaderRow}>
        <Text style={styles.netWorthTitle}>Net Worth Snapshot</Text>
        <View style={[styles.netWorthBadge, badgeToneStyle]}>
          <Ionicons name={profile.icon} size={12} color={badgeIconColor} />
          <Text style={[styles.netWorthBadgeText, badgeToneTextStyle]}>{profile.label}</Text>
        </View>
      </View>

      <Text style={[styles.netWorthValue, netWorth >= 0 ? styles.netWorthValuePositive : styles.netWorthValueNegative]}>
        {fmt(netWorth, currency)}
      </Text>

      <Text style={styles.netWorthSubtitle}>{profile.subtitle}</Text>

      <View style={styles.netWorthSplitTrack}>
        <View style={[styles.netWorthSplitAssets, { flex: split.assetsFlex }]} />
        {split.liabilitiesFlex > 0 ? <View style={[styles.netWorthSplitLiabilities, { flex: split.liabilitiesFlex }]} /> : null}
      </View>

      <View style={styles.netWorthMetaRow}>
        <Text style={styles.netWorthMetaText}>Assets {fmt(totalAssets, currency)}</Text>
        <Text style={styles.netWorthMetaDivider}>•</Text>
        <Text style={styles.netWorthMetaText}>Liabilities {fmt(totalLiabilities, currency)}</Text>
      </View>

      <View style={styles.netWorthSignalsRow}>
        <Text style={styles.netWorthSignalText}>{profile.coverageText}</Text>
        <Text style={styles.netWorthSignalText}>{profile.debtText}</Text>
      </View>
    </View>
  );
}