import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { DebtSummaryData, DebtSummaryItem, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import type { DebtStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";

type Nav = NativeStackNavigationProp<DebtStackParamList, "DebtList">;

const TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  store_card: "Store Card",
  loan: "Loan",
  mortgage: "Mortgage",
  hire_purchase: "Hire Purchase",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  credit_card: "#e25c5c",
  store_card: "#f4a942",
  loan: "#a78bfa",
  mortgage: "#38bdf8",
  hire_purchase: "#f4a942",
  other: "#64748b",
};

function DebtCard({
  debt,
  currency,
  onPress,
}: {
  debt: DebtSummaryItem;
  currency: string;
  onPress: () => void;
}) {
  const accentColor = TYPE_COLORS[debt.type] ?? T.accent;
  const progressPct =
    debt.initialBalance > 0
      ? Math.min(100, ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100)
      : 100;
  const isPaid = debt.paid || debt.currentBalance <= 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.cardPressed]}>
      <View style={[s.cardAccent, { backgroundColor: accentColor }]} />
      <View style={s.cardBody}>
        {/* Top row */}
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <Text style={s.cardName} numberOfLines={1}>{debt.displayTitle ?? debt.name}</Text>
            <Text style={[s.cardType, { color: accentColor }]}>
              {debt.displaySubtitle ?? TYPE_LABELS[debt.type] ?? debt.type}
            </Text>
          </View>
          <View style={s.cardRight}>
            <Text style={[s.cardBalance, isPaid && s.cardBalancePaid]}>
              {isPaid ? "Paid off" : fmt(debt.currentBalance, currency)}
            </Text>
            {!isPaid && debt.computedMonthlyPayment > 0 && (
              <Text style={s.cardMonthly}>
                {fmt(debt.computedMonthlyPayment, currency)}/mo
              </Text>
            )}
          </View>
        </View>

        {/* Progress bar */}
        {!isPaid && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <View
                style={[
                  s.progressFill,
                  { width: `${progressPct}%` as `${number}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
            <Text style={s.progressPct}>{progressPct.toFixed(0)}% paid</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.cardFooter}>
          {debt.interestRate != null && debt.interestRate > 0 && (
            <Text style={s.cardMeta}>{debt.interestRate}% APR</Text>
          )}
          {debt.dueDay != null && !isPaid && (
            <Text style={s.cardMeta}>Due day {debt.dueDay}</Text>
          )}
          {isPaid && (
            <View style={s.paidBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#3ec97e" />
              <Text style={s.paidBadgeText}>Fully paid</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={s.cardChevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function DebtScreen() {
  const navigation = useNavigation<Nav>();

  const [summary, setSummary] = useState<DebtSummaryData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [addType, setAddType] = useState("loan");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, sets] = await Promise.all([
        apiFetch<DebtSummaryData>("/api/bff/debt-summary"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setSummary(s);
      setSettings(sets);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const name = addName.trim();
    const balance = parseFloat(addBalance);
    if (!name) { Alert.alert("Missing name", "Enter a debt name."); return; }
    if (isNaN(balance) || balance <= 0) { Alert.alert("Invalid amount", "Enter a valid balance."); return; }
    try {
      setSaving(true);
      await apiFetch("/api/bff/debts", {
        method: "POST",
        body: { name, initialBalance: balance, currentBalance: balance, type: addType, budgetPlanId: settings?.id ?? "" },
      });
      setAddName(""); setAddBalance(""); setShowAddForm(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add debt");
    } finally {
      setSaving(false);
    }
  };

  const visibleDebts = (summary?.debts ?? []).filter((d) =>
    filter === "active" ? d.isActive && !d.paid : true,
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}><ActivityIndicator size="large" color="#0f282f" /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(15,40,47,0.55)" />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <FlatList
        data={visibleDebts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0f282f" />
        }
        ListHeaderComponent={
          <>
            {/* Summary cards */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Total Debt</Text>
                <Text style={[s.statValue, { color: "#e25c5c" }]}>
                  {fmt(summary?.totalDebtBalance ?? 0, currency)}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Monthly</Text>
                <Text style={[s.statValue, { color: "#f4a942" }]}>
                  {fmt(summary?.totalMonthlyDebtPayments ?? 0, currency)}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Active</Text>
                <Text style={[s.statValue, { color: "#0f282f" }]}>
                  {summary?.activeCount ?? 0}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Paid off</Text>
                <Text style={[s.statValue, { color: "#3ec97e" }]}>
                  {summary?.paidCount ?? 0}
                </Text>
              </View>
            </View>

            {/* Tips */}
            {(summary?.tips ?? []).length > 0 && (
              <View style={s.tipsCard}>
                {summary!.tips.slice(0, 2).map((tip, i) => (
                  <View key={i} style={[s.tipRow, i > 0 && s.tipBorder]}>
                    <Ionicons name="bulb-outline" size={14} color="#f4a942" style={{ marginTop: 1 }} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.tipTitle}>{tip.title}</Text>
                      <Text style={s.tipDetail}>{tip.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Filter + Add header */}
            <View style={s.listHeader}>
              <View style={s.filterRow}>
                <Pressable
                  onPress={() => setFilter("active")}
                  style={[s.filterBtn, filter === "active" && s.filterBtnActive]}
                >
                  <Text style={[s.filterTxt, filter === "active" && s.filterTxtActive]}>Active</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFilter("all")}
                  style={[s.filterBtn, filter === "all" && s.filterBtnActive]}
                >
                  <Text style={[s.filterTxt, filter === "all" && s.filterTxtActive]}>All</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setShowAddForm((v) => !v)} style={s.addBtn}>
                <Ionicons name={showAddForm ? "close" : "add-circle-outline"} size={22} color="#0f282f" />
                <Text style={s.addBtnTxt}>{showAddForm ? "Cancel" : "Add Debt"}</Text>
              </Pressable>
            </View>

            {/* Add form */}
            {showAddForm && (
              <View style={s.addForm}>
                <Text style={s.addFormTitle}>New Debt</Text>
                <TextInput
                  style={s.input}
                  placeholder="Name (e.g. Car loan)"
                  placeholderTextColor="#4a5568"
                  value={addName}
                  onChangeText={setAddName}
                  autoFocus
                />
                <TextInput
                  style={s.input}
                  placeholder="Current balance"
                  placeholderTextColor="#4a5568"
                  value={addBalance}
                  onChangeText={setAddBalance}
                  keyboardType="decimal-pad"
                />
                {/* Type selector */}
                <View style={s.typeRow}>
                  {Object.keys(TYPE_LABELS).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setAddType(t)}
                      style={[s.typeBtn, addType === t && { backgroundColor: TYPE_COLORS[t] + "33", borderColor: TYPE_COLORS[t] }]}
                    >
                      <Text style={[s.typeBtnTxt, addType === t && { color: TYPE_COLORS[t] }]}>
                        {TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={handleAdd} disabled={saving} style={[s.saveBtn, saving && s.disabled]}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnTxt}>Add Debt</Text>}
                </Pressable>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <DebtCard
            debt={item}
            currency={currency}
            onPress={() => navigation.navigate("DebtDetail", { debtId: item.id, debtName: item.displayTitle ?? item.name })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="card-outline" size={52} color="#1a3d3f" />
            <Text style={s.emptyTitle}>No active debts</Text>
            <Text style={s.emptySubtitle}>Tap "Add Debt" to track a debt</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f4f7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { paddingBottom: 140 },

  statsRow: { flexDirection: "row", gap: 8, padding: 14, paddingBottom: 0 },
  statCard: {
    flex: 1, backgroundColor: "#ffffff", borderRadius: 12, padding: 12,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  statLabel: { color: "rgba(15,40,47,0.55)", fontSize: 10, fontWeight: "800", marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: "800" },

  tipsCard: { margin: 14, marginBottom: 0, backgroundColor: "#ffffff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(15,40,47,0.10)" },
  tipRow: { flexDirection: "row", paddingVertical: 6 },
  tipBorder: { borderTopWidth: 1, borderTopColor: "rgba(15,40,47,0.10)", marginTop: 6 },
  tipTitle: { color: "#0f282f", fontSize: 13, fontWeight: "900" },
  tipDetail: { color: "rgba(15,40,47,0.62)", fontSize: 12, marginTop: 2, fontWeight: "600" },

  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  filterRow: { flexDirection: "row", gap: 6 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  filterBtnActive: { backgroundColor: "rgba(15,40,47,0.06)", borderColor: "rgba(15,40,47,0.18)" },
  filterTxt: { color: "rgba(15,40,47,0.55)", fontSize: 13, fontWeight: "800" },
  filterTxtActive: { color: "#0f282f" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnTxt: { color: "#0f282f", fontSize: 14, fontWeight: "900" },

  addForm: {
    margin: 14, marginTop: 0, backgroundColor: "#ffffff",
    borderRadius: 12, padding: 14, gap: 10,
    borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  addFormTitle: { color: "#0f282f", fontWeight: "900", fontSize: 15 },
  input: {
    backgroundColor: "rgba(15,40,47,0.06)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: "#0f282f", fontSize: 14, borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(15,40,47,0.12)",
  },
  typeBtnTxt: { color: "rgba(15,40,47,0.55)", fontSize: 12, fontWeight: "800" },
  saveBtn: { backgroundColor: T.accent, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },

  // Debt card
  card: {
    flexDirection: "row", marginHorizontal: 14, marginBottom: 10,
    backgroundColor: "#ffffff", borderRadius: 14,
    overflow: "hidden", borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  cardPressed: { opacity: 0.75 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  cardName: { color: "#0f282f", fontSize: 15, fontWeight: "900" },
  cardType: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  cardBalance: { color: "#0f282f", fontSize: 17, fontWeight: "900" },
  cardBalancePaid: { color: "#3ec97e" },
  cardMonthly: { color: "rgba(15,40,47,0.55)", fontSize: 12, marginTop: 2, fontWeight: "600" },
  progressWrap: { gap: 4 },
  progressBg: { height: 5, backgroundColor: "rgba(15,40,47,0.10)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPct: { color: "rgba(15,40,47,0.55)", fontSize: 11, fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardMeta: { color: "rgba(15,40,47,0.55)", fontSize: 12, fontWeight: "600" },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  paidBadgeText: { color: "#3ec97e", fontSize: 12, fontWeight: "600" },
  cardChevron: { color: "rgba(15,40,47,0.25)", fontSize: 20 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: "rgba(15,27,45,0.65)", fontSize: 16, fontWeight: "800" },
  emptySubtitle: { color: "rgba(15,27,45,0.45)", fontSize: 13 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
