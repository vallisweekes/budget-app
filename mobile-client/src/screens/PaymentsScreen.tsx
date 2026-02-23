import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import type { RootStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import { CARD_RADIUS, cardBase } from "@/lib/ui";

type Nav = NativeStackNavigationProp<RootStackParamList, "Payments">;

type ExpenseRow = {
  id: string;
  name: string;
  dueAmount: number;
};

type DebtRow = {
  id: string;
  name: string;
  dueAmount: number;
};

type PaymentsResponse = {
  budgetPlanId: string;
  year: number;
  month: number;
  expenses: ExpenseRow[];
  debts: DebtRow[];
};

type PaymentDetail = {
  kind: "expense" | "debt";
  budgetPlanId: string;
  id: string;
  name: string;
  dueAmount: number;
  dueDate: string | null;
  dueDay: number | null;
  overdue: boolean;
  missed: boolean;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    source: string;
  }>;
};

export default function PaymentsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [settings, setSettings] = useState<Settings | null>(null);
  const [data, setData] = useState<PaymentsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<{
    kind: "expense" | "debt";
    id: string;
    name: string;
    dueAmount: number;
  } | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetDetail, setSheetDetail] = useState<PaymentDetail | null>(null);

  const currency = currencySymbol(settings?.currency);

  const formatDueLabel = (detail: PaymentDetail | null): string => {
    if (!detail) return "";
    if (detail.dueDate) {
      const d = new Date(detail.dueDate);
      if (!Number.isNaN(d.getTime())) {
        return `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }
    }
    if (typeof detail.dueDay === "number" && Number.isFinite(detail.dueDay)) {
      return `Due day ${detail.dueDay}`;
    }
    return "Due date not set";
  };

  const openSheet = useCallback(
    async (item: { kind: "expense" | "debt"; id: string; name: string; dueAmount: number }) => {
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
      const [s, payments] = await Promise.all([
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<PaymentsResponse>("/api/bff/payments"),
      ]);
      setSettings(s);
      setData(payments);
      // Keep local month/year aligned to the server's notion of "current month".
      if (payments?.month && payments?.year) {
        setMonth(payments.month);
        setYear(payments.year);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();

  const expenseRows: ExpenseRow[] = useMemo(() => {
    const rows = Array.isArray(data?.expenses) ? data!.expenses : [];
    const out = rows
      .map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? "").trim(),
        dueAmount: Number(r.dueAmount ?? 0),
      }))
      .filter((r) => r.id && r.name)
      .filter((r) => (normalizedQuery ? r.name.toLowerCase().includes(normalizedQuery) : true));

    out.sort((a, b) => (Number.isFinite(b.dueAmount) ? b.dueAmount : 0) - (Number.isFinite(a.dueAmount) ? a.dueAmount : 0));
    return out;
  }, [data, normalizedQuery]);

  const debtRows: DebtRow[] = useMemo(() => {
    const rows = Array.isArray(data?.debts) ? data!.debts : [];
    const out = rows
      .map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? "").trim(),
        dueAmount: Number(r.dueAmount ?? 0),
      }))
      .filter((r) => r.id && r.name)
      .filter((r) => (normalizedQuery ? r.name.toLowerCase().includes(normalizedQuery) : true));

    out.sort((a, b) => (Number.isFinite(b.dueAmount) ? b.dueAmount : 0) - (Number.isFinite(a.dueAmount) ? a.dueAmount : 0));
    return out;
  }, [data, normalizedQuery]);

  const sections = useMemo(() => {
    const next: Array<{ title: string; data: Array<ExpenseRow | DebtRow> }> = [];
    if (expenseRows.length > 0) next.push({ title: "Expenses", data: expenseRows });
    if (debtRows.length > 0) next.push({ title: "Debts", data: debtRows });
    return next;
  }, [expenseRows, debtRows]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Main", { screen: "Dashboard" } as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}> 
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}> 
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

  const dueAmount = sheetDetail?.dueAmount ?? sheetItem?.dueAmount ?? 0;
  const paymentsTotal = (sheetDetail?.payments ?? []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const isPaid = dueAmount <= 0 ? true : paymentsTotal >= dueAmount - 0.005;
  const isPartial = !isPaid && paymentsTotal > 0;
  const statusTag = sheetDetail?.missed
    ? "Missed"
    : sheetDetail?.overdue
      ? "Overdue"
      : isPaid
        ? "Paid"
        : isPartial
          ? "Partial"
          : "Unpaid";

  const statusDescription = sheetDetail?.missed
    ? "This payment is marked as missed."
    : sheetDetail?.overdue
      ? "This payment is overdue."
      : isPaid
        ? "This payment is paid in full."
        : isPartial
          ? "This payment has been paid partially."
          : "This payment is not yet paid.";

  const heroName = String(sheetItem?.name ?? "Payment").trim();
  const heroInitial = (heroName?.[0] ?? "?").toUpperCase();
  const remaining = Math.max(0, dueAmount - paymentsTotal);
  const paymentKind = (sheetDetail?.kind ?? sheetItem?.kind ?? "payment").toString();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={closeSheet}
      >
        <View style={s.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <View style={s.sheetHandle} />

            <View style={s.sheetTopBar}>
              <Pressable onPress={closeSheet} hitSlop={10} style={s.sheetClosePlain}>
                <Ionicons name="close" size={22} color={T.text} />
              </Pressable>
              <View style={{ flex: 1 }} />
            </View>

            <View style={s.sheetHero}>
              <View style={s.sheetAvatar}>
                <Text style={s.sheetAvatarText}>{heroInitial}</Text>
              </View>
              <Text style={s.sheetHeroName} numberOfLines={1}>
                {heroName || "Payment"}
              </Text>
              <Text style={s.sheetHeroAmt} numberOfLines={1}>
                {fmt(dueAmount, currency)}
              </Text>
              <Text style={s.sheetHeroSub} numberOfLines={1}>
                {sheetDetail ? formatDueLabel(sheetDetail) : ""}
              </Text>
            </View>

            <View style={s.sheetCard}>
              <Text style={s.sheetCardTitle}>Payment</Text>
              <View style={[s.sheetCardRow, s.sheetCardRowFirst]}>
                <Text style={s.sheetCardLabel}>Type</Text>
                <Text style={s.sheetCardValue}>
                  {paymentKind === "debt" ? "Debt" : paymentKind === "expense" ? "Expense" : "Payment"}
                </Text>
              </View>
              <View style={s.sheetCardRow}>
                <Text style={s.sheetCardLabel}>Due</Text>
                <Text style={s.sheetCardValue}>{sheetDetail ? formatDueLabel(sheetDetail) : ""}</Text>
              </View>
              <View style={s.sheetCardRow}>
                <Text style={s.sheetCardLabel}>Paid so far</Text>
                <Text style={s.sheetCardValue}>{fmt(paymentsTotal, currency)}</Text>
              </View>
              <View style={s.sheetCardRow}>
                <Text style={s.sheetCardLabel}>Remaining</Text>
                <Text style={s.sheetCardValue}>{fmt(remaining, currency)}</Text>
              </View>
            </View>

            <View style={s.sheetCard}>
              <Text style={s.sheetCardTitle}>Status</Text>
              <View style={[s.sheetCardRow, s.sheetCardRowFirst]}>
                <Text style={s.sheetCardLabel}>State</Text>
                <Text
                  style={[
                    s.sheetCardValue,
                    statusTag === "Paid"
                      ? s.sheetCardValueGood
                      : statusTag === "Partial"
                        ? s.sheetCardValueWarn
                        : s.sheetCardValueBad,
                  ]}
                >
                  {statusTag}
                </Text>
              </View>
              <Text style={s.sheetCardHint}>
                {statusDescription}
              </Text>
            </View>

            <View style={[s.sheetCard, { flex: 1 }]}>
              <Text style={s.sheetCardTitle}>Payment history</Text>
              {sheetLoading ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color={T.accent} />
                </View>
              ) : sheetError ? (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={s.sheetError}>{sheetError}</Text>
                  <Pressable
                    onPress={() => {
                      if (!sheetItem) return;
                      openSheet(sheetItem);
                    }}
                    style={s.sheetRetryBtn}
                  >
                    <Text style={s.sheetRetryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={sheetDetail?.payments ?? []}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={s.sheetList}
                  ListEmptyComponent={<Text style={s.sheetEmpty}>No payments recorded yet.</Text>}
                  renderItem={({ item }) => {
                    const d = new Date(item.date);
                    const dateLabel = Number.isNaN(d.getTime())
                      ? ""
                      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                    return (
                      <View style={s.sheetPayRow}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={s.sheetPayDate}>{dateLabel}</Text>
                          <Text style={s.sheetPaySource}>{String(item.source ?? "").replaceAll("_", " ")}</Text>
                        </View>
                        <Text style={s.sheetPayAmt}>{fmt(item.amount, currency)}</Text>
                      </View>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={s.sheetSep} />}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(10, insets.top) }]}>
        <Pressable onPress={handleBack} style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
          <Ionicons name="chevron-back" size={18} color={T.text} />
        </Pressable>
        <Text style={s.title}>Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { marginTop: 10 }]}
      >
        <Ionicons name="search" size={16} color={T.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={T.textMuted}
          style={s.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <SectionList
        sections={sections as any}
        keyExtractor={(item: ExpenseRow | DebtRow) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => (
          <Pressable
            onPress={() => {
              const kind = String(section?.title).toLowerCase() === "debts" ? "debt" : "expense";
              openSheet({ kind: kind as any, id: item.id, name: item.name, dueAmount: item.dueAmount });
            }}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <Text style={s.rowName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={s.rowAmt} numberOfLines={1}>
              {fmt(item.dueAmount, currency)}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          showEmpty ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No payments due this month</Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: T.onAccent, fontWeight: "700" },

  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900" },
  sheetSub: { color: T.textDim, fontSize: 13, fontWeight: "700", marginTop: 2 },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
  },
  sheetTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 6,
  },
  sheetClosePlain: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  sheetHero: {
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: "center",
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 10,
  },
  sheetAvatarText: {
    color: T.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  sheetHeroName: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  sheetHeroAmt: {
    marginTop: 6,
    color: T.text,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  sheetHeroSub: {
    marginTop: 6,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  sheetCard: {
    marginTop: 12,
    ...cardBase,
    backgroundColor: T.cardAlt,
    borderRadius: CARD_RADIUS,
    padding: 12,
  },
  sheetCardTitle: {
    marginBottom: 10,
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
  },
  sheetCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  sheetCardRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  sheetCardLabel: { color: T.textDim, fontSize: 13, fontWeight: "800" },
  sheetCardValue: { color: T.text, fontSize: 13, fontWeight: "900" },
  sheetCardValueGood: { color: T.green },
  sheetCardValueWarn: { color: T.orange },
  sheetCardValueBad: { color: T.red },
  sheetCardHint: {
    marginTop: 8,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  sheetAmtLabel: { color: T.textDim, fontSize: 13, fontWeight: "800" },
  sheetAmt: { color: T.text, fontSize: 22, fontWeight: "900" },
  sheetFlag: { marginTop: 8, color: T.textDim, fontSize: 13, fontWeight: "800" },
  sheetSectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: T.textDim,
    fontSize: 14,
    fontWeight: "900",
  },
  sheetError: { color: T.red, fontSize: 13, fontWeight: "700" },
  sheetRetryBtn: {
    marginTop: 10,
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  sheetRetryText: { color: T.onAccent, fontWeight: "800" },
  sheetList: { paddingBottom: 18 },
  sheetEmpty: { color: T.textDim, fontSize: 13, fontStyle: "italic", paddingVertical: 12 },
  sheetPayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  sheetPayDate: { color: T.text, fontSize: 14, fontWeight: "800" },
  sheetPaySource: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 2 },
  sheetPayAmt: { color: T.text, fontSize: 14, fontWeight: "900" },
  sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: T.border },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: { transform: [{ scale: 0.98 }] },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: T.text,
  },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.text,
    fontWeight: "600",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "800",
    color: T.textDim,
  },

  row: {
    ...cardBase,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowPressed: { opacity: 0.92 },
  rowName: { flex: 1, color: T.text, fontSize: 14, fontWeight: "700" },
  rowAmt: { color: T.text, fontSize: 14, fontWeight: "800" },
  sep: { height: 10 },

  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: T.textDim, fontWeight: "700" },
});
