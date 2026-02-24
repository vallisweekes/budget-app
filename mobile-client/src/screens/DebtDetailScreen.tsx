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
  Modal,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  const [editInstallment, setEditInstallment] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAutoPay, setEditAutoPay] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      setEditInstallment(d.installmentMonths != null ? String(d.installmentMonths) : "");
      setEditDueDate(d.dueDate ? String(d.dueDate).slice(0, 10) : "");
      setEditAutoPay((d.defaultPaymentSource ?? "income") === "income");
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
    const currentPaid = parseFloat(debt.paidAmount);
    const appliedAmount = Math.min(amount, currentBal);
    const nextBalance = Math.max(0, currentBal - appliedAmount);
    const nextPaidAmount = Math.max(0, currentPaid + appliedAmount);

    const debtSnapshot = debt;
    const paymentsSnapshot = payments;

    // Optimistic update while request is in flight
    setDebt({
      ...debt,
      currentBalance: String(nextBalance),
      paidAmount: String(nextPaidAmount),
      paid: nextBalance <= 0,
    });
    setPayments((prev) => [
      {
        id: `optimistic-${Date.now()}`,
        amount: String(appliedAmount),
        paidAt: new Date().toISOString(),
        notes: null,
      },
      ...prev,
    ]);
    setPayAmount("");

    try {
      setPaying(true);
      await apiFetch(`/api/bff/debts/${debtId}/payments`, {
        method: "POST",
        body: { amount: appliedAmount },
      });
      await load();
    } catch (err: unknown) {
      setDebt(debtSnapshot);
      setPayments(paymentsSnapshot);
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
          installmentMonths: editInstallment ? parseInt(editInstallment, 10) : null,
          dueDate: editDueDate || null,
          defaultPaymentSource: editAutoPay ? "income" : "extra_funds",
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
  const originalBalNum = debt ? parseFloat((debt as Debt & { initialBalance?: string }).initialBalance ?? debt.originalBalance ?? "0") : 0;
  const paidSoFarNum = debt ? Math.max(0, parseFloat(debt.paidAmount || "0")) : 0;
  const interestRateNum = debt?.interestRate != null ? parseFloat(debt.interestRate) : null;
  const monthlyMinNum = debt?.monthlyMinimum != null ? parseFloat(debt.monthlyMinimum) : null;
  const creditLimitNum = debt?.creditLimit != null ? parseFloat(debt.creditLimit) : null;
  const dueDateValue = debt?.dueDate ? new Date(debt.dueDate) : null;
  const dueDateIso = dueDateValue && Number.isFinite(dueDateValue.getTime()) ? dueDateValue.toISOString().slice(0, 10) : null;
  const dueDateLabel = dueDateValue && Number.isFinite(dueDateValue.getTime())
    ? dueDateValue.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const isMissed = Boolean(dueDateValue && new Date().getTime() > dueDateValue.getTime() + 5 * 24 * 60 * 60 * 1000 && currentBalNum > 0);
  const isOverdue = Boolean(dueDateValue && !isMissed && new Date().getTime() > dueDateValue.getTime() && currentBalNum > 0);
  const isCardDebt = debt?.type === "credit_card" || debt?.type === "store_card";
  const isPaid = debt ? (debt.paid || currentBalNum <= 0) : false;
  const progressPct =
    originalBalNum > 0
      ? Math.min(100, (paidSoFarNum / originalBalNum) * 100)
      : currentBalNum > 0
        ? 0
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
          <View style={s.balanceHero}>
            <Text style={s.balanceHeroLabel}>Current balance</Text>
            <Text style={[s.balanceHeroValue, isPaid && { color: T.green }]}>
              {isPaid ? "Paid off" : fmt(currentBalNum, currency)}
            </Text>
            <View style={s.balanceHeroPctPill}>
              <Text style={s.balanceHeroPctTxt}>{progressPct.toFixed(1)}% paid off</Text>
            </View>
          </View>

          {/* Stats card */}
          <View style={s.statCard}>
            <View style={s.statRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>{isCardDebt && (creditLimitNum ?? 0) > 0 ? "Credit limit" : "Original"}</Text>
                <Text style={s.statValue}>{fmt(isCardDebt && (creditLimitNum ?? 0) > 0 ? (creditLimitNum ?? 0) : originalBalNum, currency)}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Paid so far</Text>
                <Text style={[s.statValue, { color: T.green }]}> 
                  {fmt(paidSoFarNum, currency)}
                </Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Due date</Text>
                <Text style={[s.statValue, isMissed ? { color: T.red } : isOverdue ? { color: T.orange } : null]}>
                  {dueDateLabel ?? "Not set"}
                </Text>
                {dueDateIso ? (
                  <Text style={s.statSub}>{isMissed ? "Missed (+5 day grace passed)" : isOverdue ? "Overdue" : "On schedule"}</Text>
                ) : null}
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
          </View>

          {/* Edit form */}
          <Modal
            visible={editing}
            transparent
            animationType="slide"
            presentationStyle="overFullScreen"
            onRequestClose={() => setEditing(false)}
          >
            <KeyboardAvoidingView style={s.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <Pressable style={s.sheetBackdrop} onPress={() => setEditing(false)} />
              <View style={s.sheetCard}>
                <View style={s.sheetHandle} />
                <Text style={s.sectionTitle}>Edit Debt</Text>

                <ScrollView style={{ maxHeight: 440 }}>
                  <View style={s.formGroup}>
                    <Text style={s.inputLabel}>Name</Text>
                    <TextInput
                      style={s.input}
                      value={editName}
                      onChangeText={setEditName}
                      placeholderTextColor={T.textMuted}
                    />
                  </View>

                  <View style={s.formRow}>
                    <View style={s.formGroup}>
                      <Text style={s.inputLabel}>Interest Rate %</Text>
                      <TextInput style={s.input} value={editRate} onChangeText={setEditRate} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} />
                    </View>
                    <View style={s.formGroup}>
                      <Text style={s.inputLabel}>Min Monthly</Text>
                      <TextInput style={s.input} value={editMin} onChangeText={setEditMin} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} />
                    </View>
                  </View>

                  <View style={s.formRow}>
                    <View style={s.formGroup}>
                      <Text style={s.inputLabel}>Due day (1-31)</Text>
                      <TextInput style={s.input} value={editDue} onChangeText={setEditDue} keyboardType="number-pad" placeholder="e.g. 15" placeholderTextColor={T.textMuted} />
                    </View>
                    <View style={s.formGroup}>
                      <Text style={s.inputLabel}>Due date (calendar)</Text>
                      <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)}>
                        <Text style={{ color: editDueDate ? T.text : T.textMuted, fontSize: 14 }}>
                          {editDueDate || "Select date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showDatePicker ? (
                    <View style={{ marginBottom: 12 }}>
                      <DateTimePicker
                        value={editDueDate ? new Date(`${editDueDate}T00:00:00`) : new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === "android") setShowDatePicker(false);
                          if (event.type === "set" && selectedDate) {
                            setEditDueDate(selectedDate.toISOString().slice(0, 10));
                          }
                        }}
                      />
                      {Platform.OS === "ios" ? (
                        <Pressable onPress={() => setShowDatePicker(false)} style={[s.saveBtn, { marginTop: 6 }]}> 
                          <Text style={s.saveBtnTxt}>Done</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={s.switchRow}>
                    <Text style={s.inputLabel}>Direct debit / standing order</Text>
                    <Switch
                      value={editAutoPay}
                      onValueChange={setEditAutoPay}
                      trackColor={{ false: T.border, true: `${T.accent}66` }}
                      thumbColor={editAutoPay ? T.accent : T.textMuted}
                    />
                  </View>

                  <Text style={s.inputLabel}>Spread over months</Text>
                  <View style={s.installmentRow}>
                    {[0, 3, 6, 12, 24, 36].map((months) => {
                      const active = (editInstallment || "0") === String(months);
                      return (
                        <Pressable
                          key={months}
                          onPress={() => setEditInstallment(months === 0 ? "" : String(months))}
                          style={[s.installmentChip, active && s.installmentChipActive]}
                        >
                          <Text style={[s.installmentChipText, active && s.installmentChipTextActive]}>
                            {months === 0 ? "None" : `${months} months`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={s.sheetActions}>
                  <Pressable onPress={() => setEditing(false)} style={[s.cancelBtn, editSaving && s.disabled]}>
                    <Text style={s.cancelBtnTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleEdit} disabled={editSaving} style={[s.saveBtn, editSaving && s.disabled, { flex: 1 }]}> 
                    {editSaving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

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

  balanceHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
  },
  balanceHeroLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  balanceHeroValue: { color: T.text, fontSize: 34, fontWeight: "900" },
  balanceHeroPctPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${T.accent}55`,
    backgroundColor: `${T.accent}1F`,
  },
  balanceHeroPctTxt: { color: T.accent, fontSize: 12, fontWeight: "800" },

  statCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 2, borderColor: T.accentBorder,
  },
  statRow: { flexDirection: "row", gap: 12 },
  statItem: { flex: 1 },
  statLabel: { color: T.textDim, fontSize: 11, fontWeight: "800", marginBottom: 4 },
  statValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  statSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },

  sectionCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 14,
    gap: 12, borderWidth: 2, borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },

  formGroup: { flex: 1, gap: 6 },
  formRow: { flexDirection: "row", gap: 10 },
  installmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2, marginBottom: 4 },
  installmentChip: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  installmentChipActive: {
    borderColor: T.accent,
    backgroundColor: `${T.accent}2A`,
  },
  installmentChipText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  installmentChipTextActive: { color: T.accent, fontWeight: "800" },
  switchRow: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    backgroundColor: T.cardAlt,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  cancelBtn: { backgroundColor: T.cardAlt, borderRadius: 8, paddingVertical: 11, alignItems: "center", flex: 1 },
  cancelBtnTxt: { color: T.textDim, fontWeight: "700", fontSize: 14 },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },

  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetCard: {
    backgroundColor: T.card,
    height: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
  },
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 4 },

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
