import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { apiFetch } from "@/lib/api";
import type { Settings } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { usePaymentsSections, useTopHeaderOffset, type PaymentsResponse } from "@/hooks";
import PaymentDetailSheet from "@/components/Payments/PaymentDetailSheet";
import PaymentsListView from "@/components/Payments/PaymentsListView";
import TopHeader from "@/components/Shared/TopHeader";
import { s } from "./style";
import type { PaymentDetail, PaymentsScreenOpenItem } from "@/types";

type PaymentsScreenProps = {
  query?: string;
};

export default function PaymentsScreen({ query = "" }: PaymentsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useTopHeaderOffset();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [data, setData] = useState<PaymentsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<PaymentsScreenOpenItem | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetDetail, setSheetDetail] = useState<PaymentDetail | null>(null);

  const currency = currencySymbol(settings?.currency);

  const openSheet = useCallback(
    async (item: PaymentsScreenOpenItem) => {
      setSheetItem(item);
      setSheetOpen(true);
      setSheetLoading(true);
      setSheetError(null);
      setSheetDetail(null);
      try {
        const budgetPlanId = data?.budgetPlanId;
        if (!budgetPlanId) throw new Error("Missing budget plan");
        const detail = await apiFetch<PaymentDetail>(
          `/api/bff/payment-detail?budgetPlanId=${encodeURIComponent(budgetPlanId)}&kind=${encodeURIComponent(
            item.kind
          )}&id=${encodeURIComponent(item.id)}`
        );
        setSheetDetail(detail);
      } catch (err) {
        setSheetError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setSheetLoading(false);
      }
    },
    [data?.budgetPlanId]
  );

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetItem(null);
    setSheetError(null);
    setSheetDetail(null);
    setSheetLoading(false);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const payments = await apiFetch<PaymentsResponse>("/api/bff/payments", { timeoutMs: 60_000 });
      const s = await apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(payments.budgetPlanId)}`, { timeoutMs: 30_000 });
      setSettings(s);
      setData(payments);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const { sections } = usePaymentsSections(data, query);
  const fallbackNotice = data?.isNextPeriodFallback
    ? "No payments left in this period. Showing upcoming items for the next period."
    : null;

  const topNav = (
    <TopHeader
      onSettings={() => router.push("/settings")}
      onIncome={() => {}}
      onAnalytics={() => router.push("/analytics")}
      onNotifications={() => router.push("/settings")}
      centerLabel="Payments"
      showIncomeAction={false}
      showAnalyticsAction
      showNotificationAction={false}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}> 
        {topNav}
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}> 
        {topNav}
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showEmpty = sections.length === 0;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <PaymentDetailSheet
        visible={sheetOpen}
        insetsBottom={insets.bottom}
        currency={currency}
        item={sheetItem}
        detail={sheetDetail}
        loading={sheetLoading}
        error={sheetError}
        onClose={closeSheet}
        onRetry={openSheet}
      />

      {topNav}

      <PaymentsListView
        query=""
        onQueryChange={() => {}}
        showSearch={false}
        sections={sections}
        fallbackNotice={fallbackNotice}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        currency={currency}
        showEmpty={showEmpty}
        onOpenItem={openSheet}
      />
    </SafeAreaView>
  );
}

