import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Debt, DebtPayment, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import type { DebtStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";

type Route = RouteProp<DebtStackParamList, "DebtDetail">;

export default function DebtDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { debtId, debtName } = params;

  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pay form
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);

  // Edit form
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, p, s] = await Promise.all([
        apiFetch<Debt>(`/api/bff/debts/${debtId}`),
        apiFetch<DebtPayment[]>(`/api/bff/debts/${debtId}/payments`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDebt(d);
      setPayments(p);
      setSettings(s);
      // seed edit fields
      setEditName(d.name);
      setEditRate(d.interestRate != null ? String(d.interestRate) : "");
      setEditMin(d.monthlyMinimum != null ? String(d.monthlyMinimum) : "");
      setEditDue(d.dueDay != null ? String(d.dueDay) : "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debt");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debtId]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid payment amount.");
      return;
    }
    if (!debt) return;
    const currentBal = parseFloat(debt.currentBalance);
    if (amount > currentBal) {
      Alert.alert("Amount too high", `Balance remaining is ${fmt(currentBal, currency)}.`);
      return;
    }
    try {
      setPaying(true);
      await apiFetch(`/api/bff/debts/${debtId}/payments`, {
        method: "POST",
        body: { amount },
      });
      setPayAmount("");
      await load();
    } catch (err: unknown) {
      Alert.alert("Payment failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  };

  const handleEdit = async () => {
    const name = editName.trim();
    if (!name) { Alert.alert("Name required"); return; }
    try {
      setEditSaving(true);
      await apiFetch(`/api/bff/debts/${debtId}`, {
        method: "PATCH",
        body: {
          name,
          interestRate: editRate ? parseFloat(editRate) : null,
          monthlyMinimum: editMin ? parseFloat(editMin) : null,
          dueDay: editDue ? parseInt(editDue, 10) : null,
        },
      });
      setEditing(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Debt",
      `Are you sure you want to delete "${debt?.name ?? debtName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/bff/debts/${debtId}`, { method: "DELETE" });
              navigation.goBack();
            } catch (err: unknown) {
              Alert.alert("Delete failed", err instanceof Error ? err.message : "Unknown error");
            }
          },
        },
      ],
    );
  };

  const currentBalNum = debt ? parseFloat(debt.currentBalance) : 0;
  const originalBalNum = debt ? parseFloat(debt.originalBalance) : 0;
  const interestRateNum = debt?.interestRate != null ? parseFloat(debt.interestRate) : null;
  const monthlyMinNum = debt?.monthlyMinimum != null ? parseFloat(debt.monthlyMinimum) : null;
  const isPaid = debt ? (debt.paid || currentBalNum <= 0) : false;
  const progressPct =
    originalBalNum > 0
      ? Math.min(100, ((originalBalNum - currentBalNum) / originalBalNum) * 100)
      : 100;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#0f282f" />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{debtName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color="#0f282f" /></View>
      </SafeAreaView>
    );
  }

  if (error || !debt) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#0f282f" />
          </Pressable>
          <Text style={s.headerTitle}>{debtName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(15,40,47,0.55)" />
          <Text style={s.errorText}>{error ?? "Debt not found"}</Text>
          <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0f282f" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{debt.name}</Text>
        <View style={s.headerActions}>
          <Pressable onPress={() => setEditing((v) => !v)} style={s.iconBtn}>
            <Ionicons name={editing ? "close" : "pencil"} size={18} color="#0f282f" />
          </Pressable>
          <Pressable onPress={handleDelete} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={18} color="#e25c5c" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#0f282f"
            />
          }
        >
          {/* Stats card */}
          <View style={s.statCard}>
            <View style={s.statRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Current Balance</Text>
                <Text style={[s.statValue, isPaid && { color: "#3ec97e" }]}>
                  {isPaid ? "Paid off" : fmt(currentBalNum, currency)}
                </Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Original</Text>
                <Text style={s.statValue}>{fmt(originalBalNum, currency)}</Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Paid so far</Text>
                <Text style={[s.statValue, { color: "#3ec97e" }]}>
                  {fmt(originalBalNum - currentBalNum, currency)}
                </Text>
              </View>
              {monthlyMinNum != null && monthlyMinNum > 0 && (
                <View style={s.statItem}>
                  <Text style={s.statLabel}>Monthly min</Text>
                  <Text style={s.statValue}>{fmt(monthlyMinNum, currency)}</Text>
                </View>
              )}
              {interestRateNum != null && interestRateNum > 0 && (
                <View style={s.statItem}>
                  <Text style={s.statLabel}>Interest Rate</Text>
                  <Text style={s.statValue}>{interestRateNum}%</Text>
                </View>
              )}
            </View>
            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
              </View>
              <Text style={s.progressPct}>{progressPct.toFixed(1)}% repaid</Text>
            </View>
          </View>

          {/* Edit form */}
          {editing && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Edit Debt</Text>
              <View style={s.formGroup}>
                <Text style={s.inputLabel}>Name</Text>
                <TextInput
                  style={s.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor="#4a5568"
                  autoFocus
                />
              </View>
              <View style={s.formRow}>
                <View style={s.formGroup}>
                  <Text style={s.inputLabel}>Interest Rate %</Text>
                  <TextInput
                    style={s.input}
                    value={editRate}
                    onChangeText={setEditRate}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#4a5568"
                  />
                </View>
                <View style={s.formGroup}>
                  <Text style={s.inputLabel}>Min Monthly</Text>
                  <TextInput
                    style={s.input}
                    value={editMin}
                    onChangeText={setEditMin}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#4a5568"
                  />
                </View>
              </View>
              <View style={[s.formGroup, { width: "48%" as `${number}%` }]}>
                <Text style={s.inputLabel}>Due day (1-31)</Text>
                <TextInput
                  style={s.input}
                  value={editDue}
                  onChangeText={setEditDue}
                  keyboardType="number-pad"
                  placeholder="e.g. 15"
                  placeholderTextColor="#4a5568"
                />
              </View>
              <Pressable
                onPress={handleEdit}
                disabled={editSaving}
                style={[s.saveBtn, editSaving && s.disabled]}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.saveBtnTxt}>Save Changes</Text>
                }
              </Pressable>
            </View>
          )}

          {/* Pay section */}
          {!isPaid && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Make a Payment</Text>
              <View style={s.payRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={`Amount (${currency})`}
                  placeholderTextColor="#4a5568"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  onPress={handlePay}
                  disabled={paying}
                  style={[s.payBtn, paying && s.disabled]}
                >
                  {paying
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.payBtnTxt}>Pay</Text>
                  }
                </Pressable>
              </View>
              {monthlyMinNum != null && monthlyMinNum > 0 && (
                <Pressable
                  onPress={() => setPayAmount(String(monthlyMinNum))}
                  style={s.quickPay}
                >
                  <Text style={s.quickPayTxt}>
                    Pay minimum ({fmt(monthlyMinNum, currency)})
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Payment history */}
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Payment History</Text>
            {payments.length === 0 ? (
              <Text style={s.emptyHistory}>No payments recorded yet.</Text>
            ) : (
              payments.map((p, i) => (
                <View key={p.id} style={[s.payHistRow, i > 0 && s.payHistBorder]}>
                  <View>
                    <Text style={s.payHistDate}>
                      {new Date(p.paidAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </Text>
                  {p.notes && <Text style={s.payHistSource}>{p.notes}</Text>}
                </View>
                  <Text style={s.payHistAmt}>- {fmt(parseFloat(p.amount), currency)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f4f7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: "#ffffff",
    borderBottomWidth: 1, borderBottomColor: "rgba(15,40,47,0.10)",
  },
  headerTitle: { flex: 1, color: "#0f282f", fontSize: 17, fontWeight: "900", marginLeft: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  iconBtn: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "rgba(15,40,47,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  scroll: { padding: 14, gap: 14, paddingBottom: 40 },

  statCard: {
    backgroundColor: "#ffffff", borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  statRow: { flexDirection: "row", gap: 12 },
  statItem: { flex: 1 },
  statLabel: { color: "rgba(15,40,47,0.55)", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  statValue: { color: "#0f282f", fontSize: 16, fontWeight: "900" },
  progressWrap: { gap: 4 },
  progressBg: { height: 7, backgroundColor: "rgba(15,40,47,0.10)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: T.accent },
  progressPct: { color: "rgba(15,40,47,0.55)", fontSize: 12, fontWeight: "600" },

  sectionCard: {
    backgroundColor: "#ffffff", borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  sectionTitle: { color: "#0f282f", fontSize: 14, fontWeight: "900" },

  formGroup: { flex: 1, gap: 6 },
  formRow: { flexDirection: "row", gap: 10 },
  inputLabel: { color: "rgba(15,40,47,0.55)", fontSize: 12, fontWeight: "800" },
  input: {
    backgroundColor: "rgba(15,40,47,0.06)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: "#0f282f", fontSize: 14, borderWidth: 1, borderColor: "rgba(15,40,47,0.10)",
  },
  saveBtn: { backgroundColor: T.accent, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },

  payRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  payBtn: {
    backgroundColor: "#3ec97e", borderRadius: 8, paddingVertical: 11,
    paddingHorizontal: 22, alignItems: "center",
  },
  payBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  quickPay: { alignSelf: "flex-start" },
  quickPayTxt: { color: "#0f282f", fontSize: 13, fontWeight: "900" },

  payHistRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  payHistBorder: { borderTopWidth: 1, borderTopColor: "rgba(15,40,47,0.10)" },
  payHistDate: { color: "#0f282f", fontSize: 13, fontWeight: "800" },
  payHistSource: { color: "rgba(15,40,47,0.55)", fontSize: 12, marginTop: 2, fontWeight: "600" },
  payHistAmt: { color: "#3ec97e", fontSize: 14, fontWeight: "800" },
  emptyHistory: { color: "rgba(15,40,47,0.55)", fontSize: 13, textAlign: "center", paddingVertical: 16, fontWeight: "600" },

  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
