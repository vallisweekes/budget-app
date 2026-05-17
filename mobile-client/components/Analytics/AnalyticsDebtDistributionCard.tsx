import React from "react";
import { Text, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsDebtDistributionCardProps } from "@/types";

export default function AnalyticsDebtDistributionCard({ currency, items, overviewMode, title }: AnalyticsDebtDistributionCardProps) {
  return (
    <View style={s.tipCard}>
      <View style={[s.sectionGlow, s.debtGlowPrimary]} />
      <View style={s.sectionHead}>
        <View>
          <Text style={s.sectionEyebrow}>Debt composition</Text>
          <Text style={s.tipTitle}>{title}</Text>
        </View>
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{overviewMode === "year" ? "Yearly" : "Monthly"}</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={s.tipText}>{overviewMode === "year" ? "No active debt balances." : "No debt payments due this month."}</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={s.barRow}>
            <View style={s.barRowHead}>
              <Text style={s.barName} numberOfLines={1}>{item.name}</Text>
              <View style={s.barValuePill}>
                <Text style={s.barValue}>{fmt(item.value, currency)}</Text>
              </View>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.max(6, item.ratio * 100)}%` }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}