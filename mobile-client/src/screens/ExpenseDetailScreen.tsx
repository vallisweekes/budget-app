import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import type { ExpensesStackParamList } from "@/navigation/types";
import type { Expense } from "@/lib/apiTypes";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

type LoadState = {
  expense: Expense | null;
  categoryExpenses: Expense[];
};

function formatUpdatedLabel(lastPaymentAt: string | null | undefined): string {
  if (!lastPaymentAt) return "No payment made";
  const d = new Date(lastPaymentAt);
  if (Number.isNaN(d.getTime())) return "No payment made";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();

  const { expenseId, expenseName, categoryId, categoryName, color, month, year, budgetPlanId, currency } =
    route.params;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<LoadState>({ expense: null, categoryExpenses: [] });

  const [paySheetOpen, setPaySheetOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [paying, setPaying] = React.useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}${qp}`);
      const inCategory = Array.isArray(all) ? all.filter((e) => e.categoryId === categoryId) : [];
      const found = inCategory.find((e) => e.id === expenseId) ?? null;
      setData({ expense: found, categoryExpenses: inCategory });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData({ expense: null, categoryExpenses: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, expenseId, month, year]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const expense = data.expense;

  const categoryTotal = data.categoryExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  const amountNum = expense ? Number(expense.amount) : 0;
  const paidNum = expense ? Number(expense.paidAmount) : 0;
  const remainingNum = Math.max(0, amountNum - paidNum);
  const isPaid = amountNum <= 0 ? true : paidNum >= amountNum - 0.005;

  const pctOfCategory = categoryTotal > 0 ? Math.round((amountNum / categoryTotal) * 100) : 0;

  const updatedLabel = expense ? formatUpdatedLabel(expense.lastPaymentAt) : "";

  const handlePay = React.useCallback(async () => {
    if (!expense || paying) return;

    const delta = Number.parseFloat(String(payAmount ?? ""));
    if (!Number.isFinite(delta) || delta <= 0) return;

    const nextPaid = Math.min(amountNum, paidNum + delta);
    const nextIsPaid = nextPaid >= amountNum - 0.005;

    setPaying(true);
    try {
      const body: Record<string, unknown> = {
        paidAmount: nextPaid,
        paid: nextIsPaid,
      };
      if (nextIsPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }

      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });

      setPaySheetOpen(false);
      setPayAmount("");
      await load();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, load, paidNum, payAmount, paying]);

  const handleMarkPaid = React.useCallback(async () => {
    if (!expense || paying) return;

    setPaying(true);
    try {
      const body: Record<string, unknown> = {
        paidAmount: amountNum,
        paid: true,
      };
      if (expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }

      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });

      setPaySheetOpen(false);
      setPayAmount("");
      await load();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, load, paying]);

  const confirmDelete = React.useCallback(async () => {
    if (!expense || deleting) return;

    setDeleting(true);
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, { method: "DELETE" });
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  }, [deleting, expense, navigation]);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {expenseName || categoryName || "Expense"}
        </Text>
        <View style={s.headerActionsPlaceholder} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error || !expense ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error ?? "Expense not found"}</Text>
          <Pressable
            onPress={() => {
              setRefreshing(true);
              void load();
            }}
            style={s.retryBtn}
          >
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={{ backgroundColor: T.bg }}
            contentContainerStyle={[s.scroll, { paddingBottom: 120 + tabBarHeight + 12 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
                tintColor={T.accent}
              />
            }
          >
            <View style={s.hero}>
              <View style={s.heroTopRow}>
                <Text style={s.heroLabel}>Total</Text>
                <View style={s.heroBadge}>
                  <Text style={s.heroBadgeTxt}>{pctOfCategory}%</Text>
                </View>
              </View>
              <Text style={s.heroAmount}>{fmt(amountNum, currency)}</Text>
              <Text style={s.heroUpdated}>Updated: {updatedLabel}</Text>

              <View style={s.heroCards}>
                <View style={s.heroCard}>
                  <Text style={s.heroCardLbl}>Paid</Text>
                  <Text style={[s.heroCardVal, { color: T.green }]}>{fmt(paidNum, currency)}</Text>
                </View>
                <View style={s.heroCard}>
                  <Text style={s.heroCardLbl}>Remaining</Text>
                  <Text style={[s.heroCardVal, { color: T.orange }]}>{fmt(remainingNum, currency)}</Text>
                </View>
              </View>

              {!isPaid ? (
                <Pressable
                  style={[s.recordBtn, height <= 740 && { marginTop: 18 }]}
                  onPress={() => {
                    setPayAmount("");
                    setPaySheetOpen(true);
                  }}
                >
                  <Text style={s.recordBtnTxt}>Record payment</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={s.detailCard}>
              <Text style={s.detailTitle}>Status</Text>
              <Text style={s.detailSub}>
                {isPaid ? "Paid" : "Unpaid"}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {expense ? (
        <View style={[s.bottomActionsWrap, { paddingBottom: tabBarHeight + 8 }]}>
          <View style={s.bottomActionsRow}>
            <Pressable style={s.bottomActionBtn} onPress={() => setDeleteConfirmOpen(true)}>
              <Text style={[s.bottomActionTxt, { color: T.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PaymentSheet
        visible={paySheetOpen}
        currency={currency}
        payAmount={payAmount}
        paying={paying}
        onChangeAmount={setPayAmount}
        onClose={() => {
          if (paying) return;
          setPaySheetOpen(false);
        }}
        onSave={handlePay}
        onMarkPaid={handleMarkPaid}
      />

      <DeleteConfirmSheet
        visible={deleteConfirmOpen}
        title="Delete Expense"
        description={`Are you sure you want to delete "${expenseName}"? This cannot be undone.`}
        isBusy={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteConfirmOpen(false);
        }}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: "#2a0a9e",
  },
  headerTitle: { flex: 1, color: "#ffffff", fontSize: 17, fontWeight: "900", marginLeft: 4 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  headerActionsPlaceholder: { width: 36 },

  scroll: { paddingHorizontal: 14, paddingTop: 0, gap: 14 },

  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: 0,
    marginHorizontal: -14,
    gap: 6,
    backgroundColor: "#2a0a9e",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(110,231,160,0.12)",
    borderWidth: 1,
    borderColor: "rgba(110,231,160,0.26)",
  },
  heroBadgeTxt: { color: "#6ee7a0", fontSize: 11, fontWeight: "800" },
  heroAmount: { color: "#ffffff", fontSize: 48, fontWeight: "900", letterSpacing: -1, marginBottom: 4 },
  heroUpdated: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "500", marginBottom: 18 },
  heroCards: { flexDirection: "row", gap: 10, justifyContent: "center" },
  heroCard: {
    width: 140,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardLbl: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", marginBottom: 5 },
  heroCardVal: { fontSize: 16, fontWeight: "900" },

  recordBtn: {
    marginTop: 28,
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  recordBtnTxt: { color: "#2a0a9e", fontSize: 15, fontWeight: "900" },

  detailCard: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
  },
  detailTitle: { color: T.text, fontSize: 13, fontWeight: "900", marginBottom: 6 },
  detailSub: { color: T.textDim, fontSize: 12, fontWeight: "700" },

  bottomActionsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: T.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  bottomActionsRow: { flexDirection: "row", gap: 12 },
  bottomActionBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomActionTxt: { fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
});
