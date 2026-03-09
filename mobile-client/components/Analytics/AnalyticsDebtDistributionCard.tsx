import React from "react";
import { Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsDebtDistributionCardProps } from "@/types";

export default function AnalyticsDebtDistributionCard({ currency, items, overviewMode, title }: AnalyticsDebtDistributionCardProps) {
  return (
    <View style={s.tipCard}>
      <Text style={s.tipTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={s.tipText}>{overviewMode === "year" ? "No active debt balances." : "No debt payments due this month."}</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={s.barRow}>
            <View style={s.barRowHead}>
              <Text style={s.barName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.barValue}>{fmt(item.value, currency)}</Text>
            </View>
            <View style={s.barTrack}>
              <Svg width="100%" height={8}>
                <Rect x="0" y="0" width="100%" height="8" rx="4" fill={T.border} />
                <Rect x="0" y="0" width={`${Math.max(6, item.ratio * 100)}%`} height="8" rx="4" fill={T.accent} />
              </Svg>
            </View>
          </View>
        ))
      )}
    </View>
  );
}