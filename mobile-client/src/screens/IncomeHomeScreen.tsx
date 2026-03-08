import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { Settings } from "@/lib/apiTypes";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import type { IncomeStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<IncomeStackParamList, "IncomeHome">;

export default function IncomeHomeScreen({ navigation }: Props) {
  const topHeaderOffset = useTopHeaderOffset(-32);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAndRedirect = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const settings = await apiFetch<Settings>("/api/bff/settings", { cacheTtlMs: 0 });
      const budgetPlanId = typeof settings?.id === "string" ? settings.id : "";
      if (!budgetPlanId) {
        throw new Error("Missing budget plan");
      }

      const payFrequency = normalizePayFrequency(settings?.payFrequency);
      const active = resolveActivePayPeriod({
        now: new Date(),
        payDate: settings?.payDate ?? 27,
        payFrequency,
        planCreatedAt: settings?.setupCompletedAt
          ? new Date(settings.setupCompletedAt)
          : settings?.accountCreatedAt
            ? new Date(settings.accountCreatedAt)
            : null,
      });
      const anchor = getPayPeriodAnchorFromWindow({ period: active, payFrequency });
      const month = anchor.month;
      const year = anchor.year;

      navigation.replace("IncomeMonth", {
        month,
        year,
        budgetPlanId,
        initialMode: "income",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open income");
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    void loadAndRedirect();
  }, [loadAndRedirect]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, paddingTop: topHeaderOffset }} edges={["bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, paddingTop: topHeaderOffset }} edges={["bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
          Income unavailable
        </Text>
        <Text style={{ color: T.textDim, fontSize: 13, marginTop: 8, textAlign: "center" }}>
          {error ?? "Please try again."}
        </Text>
        <Pressable
          onPress={loadAndRedirect}
          style={{ marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border }}
        >
          <Text style={{ color: T.text, fontSize: 13, fontWeight: "800" }}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
