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
import { useNavigation } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Settings } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { T } from "@/lib/theme";
import PaymentDetailSheet from "@/components/Payments/PaymentDetailSheet";
import { usePaymentsSections, type PaymentsResponse } from "@/lib/hooks/usePaymentsSections";
import PaymentsListView from "@/components/Payments/PaymentsListView";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { s } from "./style";
import type { PaymentDetail, PaymentsScreenNavigation, PaymentsScreenOpenItem } from "@/types";

export default function PaymentsScreen() {
  const navigation = useNavigation<PaymentsScreenNavigation>();
  const insets = useSafeAreaInsets();
  const topHeaderOffset = useTopHeaderOffset();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [data, setData] = useState<PaymentsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

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
      const payments = await apiFetch<PaymentsResponse>("/api/bff/payments");
      const s = await apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(payments.budgetPlanId)}`);
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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Main", { screen: "Dashboard" } as any);
  };

  if (loading) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}> 
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}> 
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
		<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
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

      {/* Header */}
			<View style={[s.header, { paddingTop: 10 }]}>
        <Pressable onPress={handleBack} style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
          <Ionicons name="chevron-back" size={18} color={T.text} />
        </Pressable>
        <Text style={s.title}>Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      <PaymentsListView
        query={query}
        onQueryChange={setQuery}
        sections={sections}
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

