import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import { T } from "@/lib/theme";
import type { AnalyticsInsightRow } from "@/types/AnalyticsScreen.types";

export default function AnalyticsInsightGrid({ rows }: { rows: AnalyticsInsightRow[] }) {
  const variants: Record<string, { icon: keyof typeof Ionicons.glyphMap; tone: string; chip: string }> = {
    income: { icon: "cash-outline", tone: "#3b99ff", chip: "Cash in" },
    expenses: { icon: "receipt-outline", tone: T.red, chip: "Outflow" },
    debt: { icon: "card-outline", tone: T.orange, chip: "Liabilities" },
    "debt load": { icon: "pulse-outline", tone: T.accent, chip: "Pressure" },
  };

  return (
    <View style={s.grid}>
      {rows.map((row) => {
        const variant = variants[row.label.toLowerCase()] ?? { icon: "analytics-outline", tone: T.accent, chip: "Snapshot" };
        return (
          <View key={row.label} style={s.card}>
            <View style={[s.cardGlow, { backgroundColor: `${variant.tone}22` }]} />
            <View style={[s.cardGlowSecondary, { backgroundColor: `${variant.tone}12` }]} />
            <View style={s.cardTopRow}>
              <View style={[s.cardIconWrap, { backgroundColor: `${variant.tone}14`, borderColor: `${variant.tone}38` }]}>
                <Ionicons name={variant.icon} size={18} color={variant.tone} />
              </View>
              <View style={[s.cardChip, { backgroundColor: `${variant.tone}14`, borderColor: `${variant.tone}26` }]}>
                <Text style={[s.cardChipText, { color: variant.tone }]}>{variant.chip}</Text>
              </View>
            </View>
            <Text style={s.cardLabel}>{row.label}</Text>
            <Text style={s.cardValue}>{row.value}</Text>
            <Text style={s.cardSub}>{row.sub}</Text>
            <View style={[s.cardAccentLine, { backgroundColor: variant.tone }]} />
          </View>
        );
      })}
    </View>
  );
}