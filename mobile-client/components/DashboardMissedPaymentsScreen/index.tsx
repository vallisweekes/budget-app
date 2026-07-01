import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation, useTopHeaderOffset } from "@/hooks";
import { apiFetch } from "@/lib/api";
import type { ExpenseInsights, RecapMissedPaymentItem } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import { styles } from "@/components/DashboardMissedPaymentsScreen/style";
import QuickPaymentActionSheet from "@/components/Dashboard/QuickPaymentActionSheet";
import type { QuickPaymentActionItem } from "@/types";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

type MissedExpenseRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  dueDate: string | null;
  dueAmount: number;
};

export default function DashboardMissedPaymentsScreen() {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const topHeaderOffset = useTopHeaderOffset(-18);
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>;
  const budgetPlanId = getParamString(params.budgetPlanId);

  const [items, setItems] = useState<MissedExpenseRow[]>([]);
  const [quickPayItem, setQuickPayItem] = useState<QuickPaymentActionItem | null>(null);
  const [recapSummary, setRecapSummary] = useState<{ count: number; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const response = await apiFetch<Pick<ExpenseInsights, "recap" | "missedPayments">>(
        `/api/bff/expense-insights${qp}`,
        { timeoutMs: 60_000 },
      );

      setRecapSummary(response.recap
        ? {
            count: Number(response.recap.missedDueCount ?? 0),
            amount: Number(response.recap.missedDueAmount ?? 0),
          }
        : { count: 0, amount: 0 });

      const missedRows = Array.isArray(response.missedPayments) ? response.missedPayments : [];
      const next = missedRows
        .map((row: RecapMissedPaymentItem) => ({
          id: String(row.id ?? "").trim(),
          name: String(row.name ?? "").trim(),
          logoUrl: typeof row.logoUrl === "string" ? row.logoUrl : null,
          dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
          dueAmount: Number(row.dueAmount ?? 0),
        }))
        .filter((row) => row.id.length > 0 && row.name.length > 0)
        .filter((row) => row.dueAmount > 0)
        .sort((a, b) => b.dueAmount - a.dueAmount)
        .slice(0, 50);

      setItems(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load missed payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const fallbackCurrency = getParamString(params.currency);
  const currency = fallbackCurrency || "£";

  const recapTitle = getParamString(params.recapTitle) || t("dashboard.missedPaymentsTitle");
  const computedCount = items.length;
  const computedAmount = items.reduce((sum, row) => sum + row.dueAmount, 0);
  const displayCount = recapSummary?.count ?? computedCount;
  const displayAmount = recapSummary?.amount ?? computedAmount;

  const closeQuickPay = useCallback(() => {
    setQuickPayItem(null);
  }, []);

  const handleQuickPayUpdated = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const openQuickPay = useCallback((item: MissedExpenseRow) => {
    setQuickPayItem({
      kind: "expense",
      id: item.id,
      name: item.name,
      amount: item.dueAmount,
      logoUrl: item.logoUrl,
      dueDate: item.dueDate,
      subtitle: t("dashboard.missedPaymentsTitle"),
    });
  }, [t]);

  const renderRow = useCallback((item: MissedExpenseRow) => {
    const logoUri = resolveLogoUri(item.logoUrl ?? null);
    const logoKey = `expense:${item.id}`;
    const showLogo = Boolean(logoUri) && !failedLogos[logoKey];

    return (
      <Pressable
        key={item.id}
        onPress={() => openQuickPay(item)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.rowLeft}>
          <View style={styles.avatarWrap}>
            {showLogo ? (
              <Image
                source={{ uri: logoUri ?? undefined }}
                style={styles.avatarLogo}
                resizeMode="cover"
                onError={() => setFailedLogos((current) => ({ ...current, [logoKey]: true }))}
              />
            ) : (
              <Text style={styles.avatarText}>{(item.name.trim().charAt(0) || "?").toUpperCase()}</Text>
            )}
          </View>

          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {t("tabs.expenses")}
            </Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.rowAmount} numberOfLines={1}>
            {fmt(item.dueAmount, currency)}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={T.textDim} />
        </View>
      </Pressable>
    );
  }, [currency, failedLogos, openQuickPay, t]);

  const contentTopPadding = Math.max(52, topHeaderOffset + 16);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[styles.center, { paddingTop: contentTopPadding }]}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[styles.center, { paddingTop: contentTopPadding }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => {
            setRefreshing(true);
            void load();
          }}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasRows = items.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <QuickPaymentActionSheet
        visible={Boolean(quickPayItem)}
        item={quickPayItem}
        currency={currency}
        insetsBottom={insets.bottom}
        onClose={closeQuickPay}
        onUpdated={handleQuickPayUpdated}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: contentTopPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setFailedLogos({});
              void load();
            }}
            tintColor={T.accent}
            colors={[T.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{recapTitle}</Text>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.summaryMetaValue}>{displayCount}</Text>
            <Text style={styles.summaryMetaLabel}>{t("common.total")}</Text>
          </View>
          <Text style={styles.summaryAmount}>{fmt(displayAmount, currency)}</Text>
        </View>

        {hasRows ? (
          <View style={styles.listCard}>
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{t("tabs.expenses")}</Text>
              {items.map((row) => renderRow(row))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("dashboard.missedPaymentsEmpty")}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
