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
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(15,40,47,0.55)" />
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
            <View style={s.sheetHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.sheetTitle} numberOfLines={1}>
                  {sheetItem?.name ?? "Payment"}
                </Text>
                <Text style={s.sheetSub} numberOfLines={1}>
                  {sheetDetail ? formatDueLabel(sheetDetail) : ""}
                </Text>
              </View>
              <Pressable onPress={closeSheet} hitSlop={10} style={s.sheetCloseBtn}>
                <Ionicons name="close" size={20} color="#0f282f" />
              </Pressable>
            </View>

            <View style={s.sheetTopRow}>
              <Text style={s.sheetAmtLabel}>Amount due</Text>
              <Text style={s.sheetAmt}>{fmt(sheetDetail?.dueAmount ?? sheetItem?.dueAmount ?? 0, currency)}</Text>
            </View>
            {sheetDetail?.missed ? (
              <Text style={s.sheetFlag}>Missed payment</Text>
            ) : sheetDetail?.overdue ? (
              <Text style={s.sheetFlag}>Overdue</Text>
            ) : null}

            <Text style={s.sheetSectionTitle}>Payment history</Text>
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
      </Modal>

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(10, insets.top) }]}>
        <Pressable onPress={handleBack} style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
          <Ionicons name="chevron-back" size={18} color="#0f282f" />
        </Pressable>
        <Text style={s.title}>Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { marginTop: 10 }]}
      >
        <Ionicons name="search" size={16} color="rgba(15,40,47,0.55)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="rgba(15,40,47,0.45)"
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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0f282f" />
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
  safe: { flex: 1, backgroundColor: "#f2f4f7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: T.onAccent, fontWeight: "700" },

  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "85%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(15,40,47,0.15)",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,40,47,0.10)",
  },
  sheetTitle: { color: "#0f282f", fontSize: 18, fontWeight: "900" },
  sheetSub: { color: "rgba(15,40,47,0.60)", fontSize: 13, fontWeight: "700", marginTop: 2 },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  sheetAmtLabel: { color: "rgba(15,40,47,0.60)", fontSize: 13, fontWeight: "800" },
  sheetAmt: { color: "#0f282f", fontSize: 22, fontWeight: "900" },
  sheetFlag: { marginTop: 8, color: "rgba(15,40,47,0.70)", fontSize: 13, fontWeight: "800" },
  sheetSectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: "rgba(15,40,47,0.80)",
    fontSize: 14,
    fontWeight: "900",
  },
  sheetError: { color: "#e25c5c", fontSize: 13, fontWeight: "700" },
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
  sheetEmpty: { color: "rgba(15,40,47,0.55)", fontSize: 13, fontStyle: "italic", paddingVertical: 12 },
  sheetPayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  sheetPayDate: { color: "#0f282f", fontSize: 14, fontWeight: "800" },
  sheetPaySource: { color: "rgba(15,40,47,0.55)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  sheetPayAmt: { color: "#0f282f", fontSize: 14, fontWeight: "900" },
  sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(15,40,47,0.10)" },

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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: { transform: [{ scale: 0.98 }] },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#0f282f",
  },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f282f",
    fontWeight: "600",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(15,40,47,0.80)",
  },

  row: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowPressed: { opacity: 0.92 },
  rowName: { flex: 1, color: "#0f282f", fontSize: 14, fontWeight: "700" },
  rowAmt: { color: "#0f282f", fontSize: 14, fontWeight: "800" },
  sep: { height: 10 },

  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: "rgba(15,40,47,0.55)", fontWeight: "700" },
});
