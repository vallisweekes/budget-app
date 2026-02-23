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
import { cardBase } from "@/lib/ui";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from "react-native-svg";

type Route = RouteProp<DebtStackParamList, "DebtDetail">;

// ─── Payoff Projection Chart ─────────────────────────────────────────────────
function buildProjection(balance: number, monthlyPayment: number, monthlyRate: number, maxMonths = 60): number[] {
  const pts: number[] = [balance];
  let b = balance;
  for (let i = 0; i < maxMonths; i++) {
    if (b <= 0) break;
    if (monthlyRate > 0) b = b * (1 + monthlyRate) - monthlyPayment;
    else b = b - monthlyPayment;
    b = Math.max(0, b);
    pts.push(b);
    if (b === 0) break;
  }
  return pts;
}

function PayoffChart({
  balance,
  monthlyPayment,
  interestRate,
  currency,
}: {
  balance: number;
  monthlyPayment: number;
  interestRate: number | null;
  currency: string;
}) {
  const [chartWidth, setChartWidth] = React.useState(300);
  const H = 150;
  const PX = 12;
  const PY = 14;
  const monthlyRate = interestRate ? interestRate / 100 / 12 : 0;
  const pts = buildProjection(balance, monthlyPayment, monthlyRate);
  const totalMonths = pts.length - 1;
  const cannotPayoff = monthlyPayment === 0 || pts[pts.length - 1] > 0;

  const toX = (i: number) => PX + (i / Math.max(1, totalMonths)) * (chartWidth - PX * 2);
  const toY = (v: number) => PY + (1 - (balance > 0 ? v / balance : 0)) * (H - PY * 2);

  const linePts = pts.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaPts = `${linePts} L${toX(totalMonths).toFixed(1)},${(H - PY).toFixed(1)} L${toX(0).toFixed(1)},${(H - PY).toFixed(1)} Z`;

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + totalMonths);
  const payoffLabel = !cannotPayoff && totalMonths > 0
    ? payoffDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;

  // Midpoint balance label
  const midIdx = Math.floor(totalMonths / 2);
  const midVal = pts[midIdx] ?? 0;

  return (
    <View>
      {/* Mini stat strip */}
      <View style={pc.strip}>
        <View style={pc.stat}>
          <Text style={pc.lbl}>REMAINING</Text>
          <Text style={[pc.val, { color: T.red }]}>{fmt(balance, currency)}</Text>
        </View>
        <View style={pc.statDivider} />
        <View style={pc.stat}>
          <Text style={pc.lbl}>MONTHS LEFT</Text>
          <Text style={[pc.val, { color: cannotPayoff ? T.orange : T.text }]}>
            {cannotPayoff ? "—" : String(totalMonths)}
          </Text>
        </View>
        <View style={pc.statDivider} />
        <View style={pc.stat}>
          <Text style={pc.lbl}>PAID OFF BY</Text>
          <Text style={[pc.val, { color: T.green }]}>{payoffLabel ?? "—"}</Text>
        </View>
      </View>

      {/* Chart */}
      <View
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        style={{ width: "100%", height: H, marginTop: 8 }}
      >
        <Svg width={chartWidth} height={H}>
          <Defs>
            <LinearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={T.accent} stopOpacity="0.4" />
              <Stop offset="1" stopColor={T.accent} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          {/* Baseline */}
          <Line x1={PX} y1={H - PY} x2={chartWidth - PX} y2={H - PY} stroke={T.border} strokeWidth={1} />
          {/* Midline tick */}
          {totalMonths > 2 && (
            <Line
              x1={toX(midIdx)} y1={H - PY + 3}
              x2={toX(midIdx)} y2={H - PY - 4}
              stroke={T.border} strokeWidth={1}
            />
          )}
          {/* Area */}
          <Path d={areaPts} fill="url(#payGrad)" />
          {/* Line */}
          <Path d={linePts} stroke={T.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Start dot */}
          <Circle cx={toX(0)} cy={toY(balance)} r={4.5} fill={T.accent} />
          {/* End dot */}
          {!cannotPayoff && (
            <Circle cx={toX(totalMonths)} cy={toY(0)} r={4.5} fill={T.green} />
          )}
          {/* Midpoint dot */}
          {totalMonths > 4 && (
            <Circle cx={toX(midIdx)} cy={toY(midVal)} r={3} fill={T.accentDim} stroke={T.accent} strokeWidth={1.5} />
          )}
        </Svg>
      </View>

      {/* Axis labels */}
      {!cannotPayoff && totalMonths > 0 && (
        <View style={pc.axisRow}>
          <Text style={pc.axisLbl}>Now</Text>
          {totalMonths > 4 && (
            <Text style={[pc.axisLbl, { textAlign: "center" }]}>
              {midIdx}mo · {fmt(midVal, currency)}
            </Text>
          )}
          <Text style={[pc.axisLbl, { textAlign: "right" }]}>{payoffLabel}</Text>
        </View>
      )}

      {cannotPayoff && monthlyPayment === 0 && (
        <Text style={pc.warn}>Enter a payment amount to see your payoff projection.</Text>
      )}
      {cannotPayoff && monthlyPayment > 0 && (
        <Text style={pc.warn}>Payment may not cover interest — try increasing it.</Text>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  strip: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: T.border },
  lbl: { color: T.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  val: { color: T.text, fontSize: 14, fontWeight: "900", marginTop: 2 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  axisLbl: { flex: 1, color: T.textMuted, fontSize: 10, fontWeight: "600" },
  warn: { color: T.orange, fontSize: 11, fontWeight: "600", marginTop: 8, textAlign: "center" },
});

// ─────────────────────────────────────────────────────────────────────────────
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
            <Ionicons name="chevron-back" size={24} color={T.text} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{debtName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error || !debt) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={T.text} />
          </Pressable>
          <Text style={s.headerTitle}>{debtName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
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
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{debt.name}</Text>
        <View style={s.headerActions}>
          <Pressable onPress={() => setEditing((v) => !v)} style={s.iconBtn}>
            <Ionicons name={editing ? "close" : "pencil"} size={18} color={T.text} />
          </Pressable>
          <Pressable onPress={handleDelete} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={T.red} />
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
              tintColor={T.accent}
            />
          }
        >
          {/* Stats card */}
          <View style={s.statCard}>
            <View style={s.statRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Current Balance</Text>
                <Text style={[s.statValue, isPaid && { color: T.green }]}>
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
                <Text style={[s.statValue, { color: T.green }]}>
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
                  placeholderTextColor={T.textMuted}
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
                    placeholderTextColor={T.textMuted}
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
                    placeholderTextColor={T.textMuted}
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
                  placeholderTextColor={T.textMuted}
                />
              </View>
              <Pressable
                onPress={handleEdit}
                disabled={editSaving}
                style={[s.saveBtn, editSaving && s.disabled]}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color={T.onAccent} />
                  : <Text style={s.saveBtnTxt}>Save Changes</Text>
                }
              </Pressable>
            </View>
          )}

          {/* Payoff projection + payment */}
          {!isPaid && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Payoff Projection</Text>
              <PayoffChart
                balance={currentBalNum}
                monthlyPayment={payAmount ? (parseFloat(payAmount) || 0) : (monthlyMinNum ?? 0)}
                interestRate={interestRateNum}
                currency={currency}
              />
              <View style={[s.payRow, { marginTop: 12 }]}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={`Payment amount (${currency})`}
                  placeholderTextColor={T.textMuted}
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
                    ? <ActivityIndicator size="small" color={T.onAccent} />
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
                    Use minimum ({fmt(monthlyMinNum, currency)})
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
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  headerTitle: { flex: 1, color: T.text, fontSize: 17, fontWeight: "900", marginLeft: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  iconBtn: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  scroll: { padding: 14, gap: 14, paddingBottom: 40 },

  statCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 2, borderColor: T.accentBorder,
  },
  statRow: { flexDirection: "row", gap: 12 },
  statItem: { flex: 1 },
  statLabel: { color: T.textDim, fontSize: 11, fontWeight: "800", marginBottom: 4 },
  statValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  progressWrap: { gap: 4 },
  progressBg: { height: 7, backgroundColor: T.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: T.accent },
  progressPct: { color: T.textDim, fontSize: 12, fontWeight: "600" },

  sectionCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 2, borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },

  formGroup: { flex: 1, gap: 6 },
  formRow: { flexDirection: "row", gap: 10 },
  inputLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  saveBtn: { backgroundColor: T.accent, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },

  payRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  payBtn: {
    backgroundColor: T.green, borderRadius: 8, paddingVertical: 11,
    paddingHorizontal: 22, alignItems: "center",
  },
  payBtnTxt: { color: T.onAccent, fontWeight: "800", fontSize: 14 },
  quickPay: { alignSelf: "flex-start" },
  quickPayTxt: { color: T.text, fontSize: 13, fontWeight: "900" },

  payHistRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  payHistBorder: { borderTopWidth: 1, borderTopColor: T.border },
  payHistDate: { color: T.text, fontSize: 13, fontWeight: "800" },
  payHistSource: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  payHistAmt: { color: T.green, fontSize: 14, fontWeight: "800" },
  emptyHistory: { color: T.textDim, fontSize: 13, textAlign: "center", paddingVertical: 16, fontWeight: "600" },

  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
