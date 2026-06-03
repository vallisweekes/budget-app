import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import { T } from "@/lib/theme";
import type { AnalyticsInsightRow } from "@/types/AnalyticsScreen.types";

type AnalyticsInsightGridProps = {
  rows: AnalyticsInsightRow[];
  onPressDebtCard?: () => void;
};

export default function AnalyticsInsightGrid({ rows, onPressDebtCard }: AnalyticsInsightGridProps) {
  const variants: Record<string, { icon: keyof typeof Ionicons.glyphMap; tone: string }> = {
    income: { icon: "cash-outline", tone: "#3b99ff" },
    expenses: { icon: "receipt-outline", tone: T.red },
    debt: { icon: "card-outline", tone: T.orange },
    "debt load": { icon: "pulse-outline", tone: T.accent },
  };

  return (
    <View style={s.grid}>
      {rows.map((row) => {
        const variantKey = (row.variantKey ?? row.label).toLowerCase();
        const variant = variants[variantKey] ?? { icon: "analytics-outline", tone: T.accent };
        const isDebtCard = variantKey === "debt";

        const cardContent = (
          <>
            <View style={s.cardTopRow}>
              <View style={[s.cardIconWrap, { backgroundColor: `${variant.tone}14`, borderColor: `${variant.tone}38` }]}> 
                <Ionicons name={variant.icon} size={18} color={variant.tone} />
              </View>
            </View>
            <Text style={s.cardLabel}>{row.label}</Text>
            <Text style={s.cardValue}>{row.value}</Text>
            <Text style={s.cardSub}>{row.sub}</Text>
          </>
        );

        if (isDebtCard && onPressDebtCard) {
          return (
            <Pressable
              key={`${row.variantKey ?? row.label}-${row.value}`}
              onPress={onPressDebtCard}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="Open debt distribution"
            >
              {cardContent}
            </Pressable>
          );
        }

        return (
          <View key={`${row.variantKey ?? row.label}-${row.value}`} style={s.card}>
            {cardContent}
          </View>
        );
      })}
    </View>
  );
}