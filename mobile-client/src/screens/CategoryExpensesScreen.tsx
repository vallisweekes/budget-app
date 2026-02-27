/**
 * CategoryExpensesScreen
 *
 * Full screen showing all expenses for a category with full CRUD:
 *  - Paid/Unpaid toggle (circle icon on left)
 *  - Inline partial payment input + "Add payment" button
 *  - Paid/Remaining progress bar
 *  - Due date badge
 *  - Pencil (edit) + Trash (delete) buttons per row
 *  - Edit name/amount via a sheet modal
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";

// ─── Types ──────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  featured: boolean;
};

type EditState = {
  id: string;
  name: string;
  amount: string;
  categoryId: string;
  dueDate: string;
  isAllocation: boolean;
  isDirectDebit: boolean;
  distributeMonths: boolean;
  distributeYears: boolean;
} | null;

type PaymentInputState = Record<string, string>; // expenseId → raw input value

// ─── Category icon helper ────────────────────────────────────────────────────

function CategoryIcon({ name, color }: { name: string | null; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;
  return (
    <View style={[is.iconWrap, { backgroundColor: withOpacity(color, 0.2) }]}> 
      {Icon ? <Icon size={18} color={color} strokeWidth={2} /> : <View style={[is.iconDot, { backgroundColor: color }]} />}
    </View>
  );
}

// ─── Due date helpers ────────────────────────────────────────────────────────

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dueDaysColor(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "#ef4444";   // overdue — red
  if (days <= 3) return "#f97316";  // very soon — orange
  if (days <= 7) return "#f4a942";  // soon — amber
  return "#3ec97e";                 // fine — green
}

function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CategoryExpensesScreen({ route, navigation }: Props) {
  const topHeaderOffset = useTopHeaderOffset();
  const { categoryId, categoryName, color, icon, month, year, budgetPlanId, currency } = route.params;

  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);

  // per-expense operation states
  const [toggling, setToggling]     = useState<Record<string, boolean>>({});
  const [deleting, setDeleting]     = useState<Record<string, boolean>>({});
  const [paying, setPaying]         = useState<Record<string, boolean>>({});
  const [paymentInput, setPaymentInput] = useState<PaymentInputState>({});
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  // edit nested sheet
  const [editState, setEditState]   = useState<EditState>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const iosDueDateBeforeRef = useRef<string>("");
  const [iosDueDateDraft, setIosDueDateDraft] = useState<Date>(new Date());
  const categoryScrollRef = useRef<ScrollView>(null);

  // delete confirmation sheet
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);

  // ─── Load expenses & categories ───────────────────────────────────────

  const loadCategories = useCallback(async () => {
    try {
      const qp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const cats = await apiFetch<Category[]>(`/api/bff/categories${qp}`);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [budgetPlanId]);

  const loadIncome = useCallback(async () => {
    try {
      const qp = new URLSearchParams({ month: String(month), year: String(year) });
      if (budgetPlanId) qp.set("budgetPlanId", budgetPlanId);
      const items = await apiFetch<Array<{ amount: string | number }>>(`/api/bff/income?${qp}`);
      if (Array.isArray(items)) {
        setTotalIncome(items.reduce((s, i) => s + Number(i.amount), 0));
      }
    } catch {
      // non-critical — badge just won't show
    }
  }, [budgetPlanId, month, year]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&refreshLogos=1${qp}`);
      setExpenses(
        Array.isArray(all) ? all.filter((e) => e.categoryId === categoryId) : []
      );
      setLogoFailed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, year]);

  const openDueDatePicker = useCallback(() => {
    iosDueDateBeforeRef.current = editState?.dueDate ?? "";
    setIosDueDateDraft(editState?.dueDate ? new Date(`${editState.dueDate}T00:00:00`) : new Date());
    setShowDatePicker(true);
  }, [editState]);

  const cancelDueDatePicker = useCallback(() => {
    setEditState((p) => (p ? { ...p, dueDate: iosDueDateBeforeRef.current } : p));
    setShowDatePicker(false);
  }, []);

  const closeDueDatePicker = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    setExpenses([]);
    load();
    loadCategories();
    loadIncome();
  }, [load, loadCategories, loadIncome]);

  // ─── Toggle paid ──────────────────────────────────────────────────────

  const handleTogglePaid = async (expense: Expense) => {
    if (toggling[expense.id]) return;
    const newPaid = !expense.paid;
    const newPaidAmount = newPaid ? expense.amount : "0";
    const newLastPaymentAt = newPaid ? new Date().toISOString() : null;
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, paid: newPaid, paidAmount: newPaidAmount, lastPaymentAt: newLastPaymentAt } : e));
    setToggling(t => ({ ...t, [expense.id]: true }));
    try {
      const body: Record<string, unknown> = { paid: newPaid, paidAmount: Number(newPaidAmount) };
      // Pass stored payment source so the server can deduct the right balance
      if (newPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });
    } catch (err) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update expense.");
    } finally {
      setToggling(t => { const n = { ...t }; delete n[expense.id]; return n; });
    }
  };

  // ─── Apply partial payment ────────────────────────────────────────────

  const handleApplyPayment = async (expense: Expense) => {
    const raw = paymentInput[expense.id] ?? "";
    const delta = parseFloat(raw);
    if (!Number.isFinite(delta) || delta <= 0) {
      Alert.alert("Invalid Amount", "Enter a payment amount greater than 0.");
      return;
		}
    const existingPaid = parseFloat(expense.paidAmount);
    const total = parseFloat(expense.amount);
    const nextPaid = Math.min(total, existingPaid + delta);
    const nextIsPaid = nextPaid >= total;

    const snapshot = expense;
    setExpenses(prev => prev.map(e =>
      e.id === expense.id
        ? { ...e, paidAmount: String(nextPaid), paid: nextIsPaid, lastPaymentAt: new Date().toISOString() }
        : e
    ));
    setPaymentInput(p => { const n = { ...p }; delete n[expense.id]; return n; });
    setPaying(p => ({ ...p, [expense.id]: true }));
    try {
      const body: Record<string, unknown> = { paidAmount: nextPaid, paid: nextIsPaid };
      if (nextIsPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body,
      });
    } catch (err) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? snapshot : e));
      Alert.alert("Error", err instanceof Error ? err.message : "Could not apply payment.");
    } finally {
      setPaying(p => { const n = { ...p }; delete n[expense.id]; return n; });
    }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────

  const openEdit = (expense: Expense) => {
    setEditState({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      categoryId: expense.categoryId || categoryId,
      dueDate: expense.dueDate ? expense.dueDate.slice(0, 10) : "",
      isAllocation: expense.isAllocation || false,
      isDirectDebit: expense.isDirectDebit || false,
      distributeMonths: false,
      distributeYears: false,
    });
    setEditError(null);
  };

  // Scroll selected category into view when edit sheet opens
  useEffect(() => {
    if (editState && categoryScrollRef.current) {
      const selectedIndex = categories.findIndex(c => c.id === editState.categoryId);
      if (selectedIndex >= 0) {
        // Each category option is approximately 100px wide (padding + text + margin)
        // Scroll to center the selected category
        const scrollX = selectedIndex * 100;
        setTimeout(() => {
          categoryScrollRef.current?.scrollTo({ x: scrollX, animated: true });
        }, 100);
      }
    }
  }, [editState, categories]);

  const handleEditSave = async () => {
    if (!editState || editSaving) return;
    const name = editState.name.trim();
    const amount = parseFloat(editState.amount);
    if (!name) { setEditError("Name is required."); return; }
    if (!Number.isFinite(amount) || amount < 0) { setEditError("Enter a valid amount."); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await apiFetch<Expense>(`/api/bff/expenses/${editState.id}`, {
        method: "PATCH",
        body: {
          name,
          amount,
          categoryId: editState.categoryId || null,
          dueDate: editState.dueDate || null,
          isAllocation: editState.isAllocation,
          isDirectDebit: editState.isDirectDebit,
          distributeMonths: editState.distributeMonths,
          distributeYears: editState.distributeYears,
        },
      });
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      setEditState(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────

  const confirmDelete = (expense: Expense) => {
    setDeleteConfirm(expense);
  };

  const doDelete = async (expense: Expense) => {
    setDeleting(d => ({ ...d, [expense.id]: true }));
    setExpenses(prev => prev.filter(e => e.id !== expense.id));
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, { method: "DELETE" });
    } catch (err) {
      setExpenses(prev => [...prev, expense].sort((a, b) => a.name.localeCompare(b.name)));
      Alert.alert("Error", err instanceof Error ? err.message : "Could not delete expense.");
    } finally {
      setDeleting(d => { const n = { ...d }; delete n[expense.id]; return n; });
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────

  const totalAmount  = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalPaid    = expenses.reduce((s, e) => s + parseFloat(e.paidAmount), 0);
  const remaining    = Math.max(0, totalAmount - totalPaid);
  const paidCount    = expenses.filter(e => e.paid).length;
  const paidPct      = totalIncome > 0 ? Math.round((totalAmount / totalIncome) * 100) : 0;

  // Latest payment across all category expenses
  const latestPaymentAt = expenses.reduce<string | null>((latest, e) => {
    if (!e.lastPaymentAt) return latest;
    if (!latest) return e.lastPaymentAt;
    return e.lastPaymentAt > latest ? e.lastPaymentAt : latest;
  }, null);
  const updatedLabel = latestPaymentAt
    ? new Date(latestPaymentAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "No payment made";

  // ─── Expense row ──────────────────────────────────────────────────────

  const resolvedColor = resolveCategoryColor(color);

  const renderItem = ({ item }: { item: Expense }) => {
    const amount   = parseFloat(item.amount);
    const paid     = parseFloat(item.paidAmount);
    const isPaid   = item.paid;
    const progress = amount > 0 ? Math.min(1, paid / amount) : 0;
    const isBusy   = !!toggling[item.id] || !!deleting[item.id] || !!paying[item.id];

    const isPartial = !isPaid && paid > 0;
    const statusLabel = isPaid ? "✓ Paid" : isPartial ? "Partial" : "Unpaid";
    const statusColor = isPaid ? T.green : isPartial ? T.orange : T.red;

    return (
      <View style={[rs.card, isBusy && deleting[item.id] && { opacity: 0.4 }]}>
        {/* Row 1: name + badges + paid button + icons */}
        <View style={rs.row1}>
          <View style={rs.logoWrap}>
            {resolveLogoUri(item.logoUrl) && !logoFailed[item.id] ? (
              <Image
                source={{ uri: resolveLogoUri(item.logoUrl)! }}
                style={rs.logoImg}
                resizeMode="cover"
                onError={() => setLogoFailed((prev) => ({ ...prev, [item.id]: true }))}
              />
            ) : (
              <Text style={rs.logoFallback}>{item.name.trim().charAt(0).toUpperCase() || "•"}</Text>
            )}
          </View>

          <View style={rs.nameCol}>
            <Text style={rs.name} numberOfLines={1}>{item.name}</Text>
            <View style={rs.badgeRow}>
              {/* Due date badge */}
              {item.dueDate && !isPaid && (
                <View style={[rs.badge, { backgroundColor: withOpacity(dueDaysColor(item.dueDate), 0.13), borderColor: withOpacity(dueDaysColor(item.dueDate), 0.33) }]}> 
                  <Text style={[rs.badgeTxt, { color: dueDaysColor(item.dueDate) }]}>
                    Due: {formatDueDate(item.dueDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={rs.actionRow}>
            {/* Paid toggle button */}
            <Pressable
              onPress={() => handleTogglePaid(item)}
              disabled={isBusy}
              style={[rs.paidBtn, isPaid ? rs.paidBtnGreen : isPartial ? rs.paidBtnOrange : rs.paidBtnRed]}
            >
              {toggling[item.id] ? (
                <ActivityIndicator size="small" color={statusColor} />
              ) : (
                <Text style={[rs.paidBtnTxt, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              )}
            </Pressable>

            {/* Edit */}
            <Pressable onPress={() => openEdit(item)} disabled={isBusy} hitSlop={8} style={rs.iconBtn}>
              <Ionicons name="pencil-outline" size={16} color={T.textDim} />
            </Pressable>

            {/* Delete */}
            <Pressable onPress={() => confirmDelete(item)} disabled={isBusy} hitSlop={8} style={rs.iconBtn}>
              <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.6)" />
            </Pressable>
          </View>
        </View>

        {/* Row 2: amount + paid / remaining */}
        <View style={rs.row2}>
          <Text style={rs.amount}>{fmt(amount, currency)}</Text>
          <Text style={rs.paidSub}>
            Paid <Text style={{ color: "#3ec97e" }}>{fmt(paid, currency)}</Text>
            {"  ·  "}
            Remaining <Text style={{ color: "#f4a942" }}>{fmt(Math.max(0, amount - paid), currency)}</Text>
          </Text>
        </View>

        {/* Row 3: progress bar */}
        <View style={rs.progressBg}>
          <View
            style={[
              rs.progressFill,
              {
                width: `${Math.round(progress * 100)}%` as any,
                backgroundColor: isPaid ? T.green : isPartial ? T.orange : T.accent,
              },
            ]}
          />
        </View>

        {/* Row 4: payment input (only when unpaid) */}
        {!isPaid && (
          <View style={rs.payRow}>
            <Text style={rs.payLabel}>Payment amount ({currency})</Text>
            <View style={rs.payInputRow}>
              <TextInput
                style={rs.payInput}
                value={paymentInput[item.id] ?? ""}
                onChangeText={(t) => setPaymentInput(p => ({ ...p, [item.id]: t }))}
                placeholder="0.00"
                placeholderTextColor={T.textMuted}
                keyboardType="decimal-pad"
                selectionColor="#0f282f"
              />
              <TouchableOpacity
                style={[rs.addPayBtn, (paying[item.id] || !(paymentInput[item.id] ?? "")) && { opacity: 0.5 }]}
                onPress={() => handleApplyPayment(item)}
                disabled={isBusy || !(paymentInput[item.id] ?? "")}
              >
                {paying[item.id]
                  ? <ActivityIndicator size="small" color={T.onAccent} />
                  : <Text style={rs.addPayTxt}>Add payment</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: topHeaderOffset + 18 }]}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>Total</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeTxt}>{paidPct}%</Text>
          </View>
        </View>
        <Text style={styles.heroAmount}>{fmt(totalAmount, currency)}</Text>
        <Text style={styles.heroUpdated}>Updated: {updatedLabel}</Text>
        <View style={styles.heroCards}>
          <View style={styles.heroCard}>
            <Text style={styles.heroCardLbl}>Paid</Text>
            <Text style={[styles.heroCardVal, { color: T.green }]}>{fmt(totalPaid, currency)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroCardLbl}>Remaining</Text>
            <Text style={[styles.heroCardVal, { color: T.orange }]}>{fmt(remaining, currency)}</Text>
          </View>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={T.textDim} />
          <Text style={styles.errTxt}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0f282f" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={40} color="#1a3d3f" />
              <Text style={styles.emptyTxt}>No expenses in this category</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* ── Edit sub-sheet ──────────────────────────────────────────────── */}
      <Modal
        visible={editState !== null}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setEditState(null)}
      >
        <KeyboardAvoidingView style={es.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={es.backdrop} onPress={() => setEditState(null)} />
          <View style={es.sheet}>
            <View style={es.handle} />
            <Text style={es.title}>Edit Expense</Text>

            <ScrollView style={es.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={es.label}>Name</Text>
              <TextInput
                style={es.input}
                value={editState?.name ?? ""}
                onChangeText={t => setEditState(p => p ? { ...p, name: t } : p)}
                placeholder="Expense name"
                placeholderTextColor={T.textMuted}
                selectionColor={T.accent}
                returnKeyType="next"
                autoFocus
              />

              <Text style={es.label}>Amount</Text>
              <TextInput
                style={es.input}
                value={editState?.amount ?? ""}
                onChangeText={t => setEditState(p => p ? { ...p, amount: t } : p)}
                placeholder="0.00"
                placeholderTextColor={T.textMuted}
                selectionColor={T.accent}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />

              <Text style={es.label}>Category</Text>
              <View style={es.pickerWrapper}>
                <ScrollView ref={categoryScrollRef} horizontal showsHorizontalScrollIndicator={false} style={es.categoryScroll}>
                  <TouchableOpacity
                    key="none"
                    style={[es.categoryOption, (!editState?.categoryId) && es.categoryOptionSelected]}
                    onPress={() => setEditState(p => p ? { ...p, categoryId: "" } : p)}
                  >
                    <Text style={[es.categoryOptionText, (!editState?.categoryId) && es.categoryOptionTextSelected]}>
                      Miscellaneous
                    </Text>
                  </TouchableOpacity>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[es.categoryOption, editState?.categoryId === cat.id && es.categoryOptionSelected]}
                      onPress={() => setEditState(p => p ? { ...p, categoryId: cat.id } : p)}
                    >
                      <Text style={[es.categoryOptionText, editState?.categoryId === cat.id && es.categoryOptionTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={es.label}>Due Date</Text>
              <TouchableOpacity
                style={es.dateButton}
                onPress={openDueDatePicker}
              >
                <Text style={[es.dateButtonText, !editState?.dueDate && es.dateButtonPlaceholder]}>
                  {editState?.dueDate ? new Date(editState.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Select date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={T.accent} />
              </TouchableOpacity>
              {showDatePicker && Platform.OS === 'android' ? (
                <View style={es.datePickerWrap}>
                  <DateTimePicker
                    value={editState?.dueDate ? new Date(editState.dueDate + 'T00:00:00') : new Date()}
                    mode="date"
                    display="calendar"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        const isoDate = selectedDate.toISOString().slice(0, 10);
                        setEditState(p => p ? { ...p, dueDate: isoDate } : p);
                      }
                    }}
                  />
                </View>
              ) : null}

              {Platform.OS === 'ios' ? (
                <Modal
                  visible={showDatePicker}
                  transparent
                  animationType="fade"
                  presentationStyle="overFullScreen"
                  onRequestClose={cancelDueDatePicker}
                >
                  <View style={es.dateModalOverlay}>
                    <Pressable style={es.dateModalBackdrop} onPress={cancelDueDatePicker} />
                    <View style={es.dateModalSheet}>
                      <View style={es.dateModalHeader}>
                        <TouchableOpacity onPress={cancelDueDatePicker} hitSlop={10}>
                          <Text style={es.dateModalCancelTxt}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={closeDueDatePicker} hitSlop={10}>
                          <Text style={es.dateModalDoneTxt}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={iosDueDateDraft}
                        mode="date"
                        display="inline"
                        onChange={(event, selectedDate) => {
                          if (event.type === 'dismissed') return;
                          const next = selectedDate ?? iosDueDateDraft;
                          setIosDueDateDraft(next);
                          const isoDate = next.toISOString().slice(0, 10);
                          setEditState(p => p ? { ...p, dueDate: isoDate } : p);
                        }}
                        themeVariant="dark"
                      />
                    </View>
                  </View>
                </Modal>
              ) : null}

              {/* Allocation toggle */}
              <View style={es.toggleRow}>
                <View style={es.toggleInfo}>
                  <Text style={es.toggleTitle}>Allocation payment</Text>
                  <Text style={es.toggleSub}>For envelopes like groceries — never becomes a debt</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditState((p) => (p ? { ...p, isAllocation: !p.isAllocation } : p))}
                  style={[es.toggle, editState?.isAllocation && es.toggleOn]}
                  activeOpacity={0.8}
                >
                  <View style={[es.toggleThumb, editState?.isAllocation && es.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              {/* Direct Debit toggle */}
              <View style={es.toggleRow}>
                <View style={es.toggleInfo}>
                  <Text style={es.toggleTitle}>Direct Debit / Standing Order</Text>
                  <Text style={es.toggleSub}>Automatically collected each month</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditState((p) => (p ? { ...p, isDirectDebit: !p.isDirectDebit } : p))}
                  style={[es.toggle, editState?.isDirectDebit && es.toggleOn]}
                  activeOpacity={0.8}
                >
                  <View style={[es.toggleThumb, editState?.isDirectDebit && es.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              {/* Distribute remaining months toggle */}
              <View style={es.toggleRow}>
                <View style={es.toggleInfo}>
                  <Text style={es.toggleTitle}>Distribute remaining months</Text>
                  <Text style={es.toggleSub}>Add to every month from now through December</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setEditState((p) =>
                      p
                        ? {
                            ...p,
                            distributeMonths: !p.distributeMonths,
                            distributeYears: !p.distributeMonths ? p.distributeYears : false,
                          }
                        : p
                    )
                  }
                  style={[es.toggle, editState?.distributeMonths && es.toggleOn]}
                  activeOpacity={0.8}
                >
                  <View style={[es.toggleThumb, editState?.distributeMonths && es.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              {/* Repeat across years toggle (available when distributeMonths is on) */}
              {editState?.distributeMonths ? (
                <View style={es.toggleRow}>
                  <View style={es.toggleInfo}>
                    <Text style={es.toggleTitle}>Repeat next year too</Text>
                    <Text style={es.toggleSub}>Also distribute across the same months next year</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEditState((p) => (p ? { ...p, distributeYears: !p.distributeYears } : p))}
                    style={[es.toggle, editState?.distributeYears && es.toggleOn]}
                    activeOpacity={0.8}
                  >
                    <View style={[es.toggleThumb, editState?.distributeYears && es.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            {editError ? <Text style={es.errTxt}>{editError}</Text> : null}

            <View style={es.actions}>
              <TouchableOpacity style={es.cancelBtn} onPress={() => setEditState(null)} disabled={editSaving}>
                <Text style={es.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[es.saveBtn, editSaving && { opacity: 0.6 }]} onPress={handleEditSave} disabled={editSaving}>
                {editSaving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={es.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete confirmation sheet ────────────────────────────────────── */}
      <Modal
        visible={deleteConfirm !== null}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View style={ds.overlay}>
          <Pressable style={ds.backdrop} onPress={() => setDeleteConfirm(null)} />
          <View style={ds.sheet}>
            <View style={ds.handle} />
            <View style={ds.iconContainer}>
              <Ionicons name="warning" size={48} color={T.red} />
            </View>
            <Text style={ds.title}>Delete Expense?</Text>
            <Text style={ds.message}>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </Text>
            <View style={ds.actions}>
              <TouchableOpacity
                style={ds.cancelBtn}
                onPress={() => setDeleteConfirm(null)}
                disabled={deleting[deleteConfirm?.id ?? ""]}
              >
                <Text style={ds.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ds.deleteBtn, deleting[deleteConfirm?.id ?? ""] && { opacity: 0.6 }]}
                onPress={() => {
                  if (deleteConfirm) {
                    doDelete(deleteConfirm);
                    setDeleteConfirm(null);
                  }
                }}
                disabled={deleting[deleteConfirm?.id ?? ""]}
              >
                {deleting[deleteConfirm?.id ?? ""] ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={ds.deleteTxt}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Icon styles
const is = StyleSheet.create({
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconDot:  { width: 10, height: 10, borderRadius: 5 },
});

// Screen styles
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerText: { flex: 1 },
  title: { color: T.text, fontSize: 16, fontWeight: "900" },
  sub:   { color: T.textDim, fontSize: 12, marginTop: 1, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },
  statLbl: { color: T.textDim, fontSize: 10, fontWeight: "700", marginBottom: 2 },
  statVal: { color: T.text, fontSize: 14, fontWeight: "900" },
  hero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroBadge: {
    backgroundColor: "rgba(100,220,140,0.25)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(100,220,140,0.45)",
  },
  heroBadgeTxt: {
    color: "#6ee7a0",
    fontSize: 11,
    fontWeight: "800",
  },
  heroAmount: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroUpdated: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 18,
  },
  heroCards: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  heroCard: {
    width: 140,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardLbl: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5,
  },
  heroCardVal: {
    fontSize: 16,
    fontWeight: "900",
  },
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errTxt: { color: T.red, fontSize: 13, textAlign: "center" },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { color: T.onAccent, fontWeight: "700", fontSize: 13 },
  emptyTxt: { color: T.textDim, fontSize: 14, fontWeight: "600" },
});

// Row / card styles
const rs = StyleSheet.create({
  card: {
    backgroundColor: T.cardAlt,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
    marginBottom: 10,
  },
  row1: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  logoWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    overflow: "hidden",
  },
  logoImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  logoFallback: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  nameCol: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  badgeTxt: { fontSize: 11, fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paidBtn: {
    height: 32, minWidth: 72,
    borderRadius: 8, paddingHorizontal: 10,
    alignItems: "center", justifyContent: "center",
  },
  paidBtnGreen: { backgroundColor: "rgba(46,229,143,0.12)" },
  paidBtnOrange:{ backgroundColor: "rgba(255,176,32,0.12)" },
  paidBtnRed:   { backgroundColor: "rgba(255,92,122,0.12)" },
  paidBtnTxt:   { fontSize: 12, fontWeight: "700" },
  iconBtn: {
    width: 30, height: 30, borderRadius: 6,
    backgroundColor: T.cardAlt,
    alignItems: "center", justifyContent: "center",
  },
  row2: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10, marginBottom: 6,
  },
  amount: { color: T.text, fontSize: 15, fontWeight: "900" },
  paidSub: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  progressBg: {
    height: 7, borderRadius: 4,
    backgroundColor: T.border,
    overflow: "hidden",
  },
  progressFill: { height: 7, borderRadius: 4 },
  payRow: { marginTop: 12 },
  payLabel: { color: T.textDim, fontSize: 11, fontWeight: "700", marginBottom: 6 },
  payInputRow: { flexDirection: "row", gap: 8 },
  payInput: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: 8, borderWidth: 1,
    borderColor: T.border,
    color: T.text, fontSize: 15,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  addPayBtn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 9,
    alignItems: "center", justifyContent: "center",
  },
  addPayTxt: { color: T.onAccent, fontSize: 13, fontWeight: "700" },
});

// Edit modal styles
const es = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: T.border,
    maxHeight: "90%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center", marginBottom: 20,
  },
  title:  { color: T.text, fontSize: 17, fontWeight: "900", marginBottom: 20 },
  label:  { color: T.textDim, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 10, borderWidth: 1,
    borderColor: T.border,
    color: T.text, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 16,
  },
  scrollContent: { maxHeight: 560, marginBottom: 12 },
  pickerWrapper: { marginBottom: 16 },
  categoryScroll: { flexGrow: 0 },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    marginRight: 8,
  },
  categoryOptionSelected: {
    backgroundColor: withOpacity(T.accent, 0.15),
    borderColor: T.accent,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.textDim,
  },
  categoryOptionTextSelected: {
    color: T.accent,
    fontWeight: "700",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    color: T.text,
    fontSize: 16,
  },
  dateButtonPlaceholder: {
    color: T.textMuted,
  },
  datePickerWrap: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    backgroundColor: T.cardAlt,
    overflow: "hidden",
  },
  dateModalOverlay: { flex: 1, justifyContent: "flex-end" },
  dateModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  dateModalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingBottom: 16,
    overflow: "hidden",
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  dateModalCancelTxt: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  dateModalDoneTxt: { color: T.accent, fontSize: 14, fontWeight: "800" },
  dateDoneBtn: {
    alignSelf: "flex-end",
    margin: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: T.accent,
  },
  dateDoneTxt: { color: T.onAccent, fontSize: 12, fontWeight: "700" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 16,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: T.text, fontSize: 14, fontWeight: "800" },
  toggleSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: `${T.accent}55`,
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.textMuted,
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    backgroundColor: T.accent,
    alignSelf: "flex-end",
  },
  errTxt: { color: T.red, fontSize: 13, marginBottom: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, backgroundColor: T.cardAlt,
    borderRadius: 10, paddingVertical: 14, alignItems: "center",
  },
  cancelTxt: { color: T.textDim, fontSize: 15, fontWeight: "700" },
  saveBtn: {
    flex: 2, backgroundColor: T.accent,
    borderRadius: 10, paddingVertical: 14, alignItems: "center",
  },
  saveTxt: { color: T.onAccent, fontSize: 15, fontWeight: "700" },
});

// Delete confirmation sheet styles
const ds = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: T.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    color: T.textDim,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
  },
  cancelTxt: {
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: T.red,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
