import React from "react";
import { Text, View } from "react-native";

import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsInsightRow } from "@/types/AnalyticsScreen.types";

export default function AnalyticsInsightGrid({ rows }: { rows: AnalyticsInsightRow[] }) {
  return (
    <View style={s.grid}>
      {rows.map((row) => (
        <View key={row.label} style={s.card}>
          <Text style={s.cardLabel}>{row.label}</Text>
          <Text style={s.cardValue}>{row.value}</Text>
          <Text style={s.cardSub}>{row.sub}</Text>
        </View>
      ))}
    </View>
  );
}