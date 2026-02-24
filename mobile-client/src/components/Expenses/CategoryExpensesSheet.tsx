/**
 * CategoryExpensesSheet
 *
 * Bottom sheet showing all expenses for a category with full CRUD:
 *  - Paid/Unpaid toggle (circle icon on left)
 *  - Inline partial payment input + "Add payment" button
 *  - Paid/Remaining progress bar
 *  - Due date badge
 *  - Pencil (edit) + Trash (delete) buttons per row
 *  - Edit name/amount via a second sheet layer
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
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import type { Expense, Settings } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Types ──────────────────────────────────────────────────────────────────

export type SheetCategory = {
  categoryId: string;
  categoryName: string;
  color: string | null;
  icon: string | null;
};

type Props = {
  visible: boolean;
  category: SheetCategory | null;
  month: number;
  year: number;
  budgetPlanId?: string | null;
  currency: string;
  onClose: () => void;
  /** Called after a mutating action so the parent can refresh summary stats */
  onMutated?: () => void;
};

type EditState = {
  id: string;
  name: string;
  amount: string;
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

// ─── Main sheet ─────────────────────────────────────────────────────────────

export default function CategoryExpensesSheet({
  visible,
  category,
  month,
  year,
  budgetPlanId,
  currency,
  onClose,
  onMutated,
}: Props) {
  const insets = useSafeAreaInsets();

  // animate slide-up
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [visible]);

  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // per-expense operation states
  const [toggling, setToggling]     = useState<Record<string, boolean>>({});
  const [deleting, setDeleting]     = useState<Record<string, boolean>>({});
  const [paying, setPaying]         = useState<Record<string, boolean>>({});
  const [paymentInput, setPaymentInput] = useState<PaymentInputState>({});
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);

  // edit nested sheet
  const [editState, setEditState]   = useState<EditState>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);

  // ─── Load expenses ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!category) return;
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}${qp}`);
      setExpenses(
        Array.isArray(all) ? all.filter((e) => e.categoryId === category.categoryId) : []
      );
      setLogoFailed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, category, month, year]);

  useEffect(() => {
    if (visible && category) {
      setLoading(true);
      setExpenses([]);
      load();
    }
  }, [visible, category, load]);

  // ─── Toggle paid ──────────────────────────────────────────────────────

  const handleTogglePaid = async (expense: Expense) => {
    if (toggling[expense.id]) return;
    const newPaid = !expense.paid;
    const newPaidAmount = newPaid ? expense.amount : "0";
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, paid: newPaid, paidAmount: newPaidAmount } : e));
    setToggling(t => ({ ...t, [expense.id]: true }));
    try {
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body: { paid: newPaid, paidAmount: Number(newPaidAmount) },
      });
      onMutated?.();
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
        ? { ...e, paidAmount: String(nextPaid), paid: nextIsPaid }
        : e
    ));
    setPaymentInput(p => { const n = { ...p }; delete n[expense.id]; return n; });
    setPaying(p => ({ ...p, [expense.id]: true }));
    try {
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body: { paidAmount: nextPaid, paid: nextIsPaid },
      });
      onMutated?.();
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
      isAllocation: expense.isAllocation || false,
      isDirectDebit: expense.isDirectDebit || false,
      distributeMonths: false,
      distributeYears: false,
    });
    setEditError(null);
  };

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
          isAllocation: editState.isAllocation,
          isDirectDebit: editState.isDirectDebit,
          distributeMonths: editState.distributeMonths,
          distributeYears: editState.distributeYears,
        },
      });
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      setEditState(null);
      onMutated?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────

  const confirmDelete = (expense: Expense) => {
    if (!expense.paid) {
      Alert.alert("Cannot Delete", "Mark the expense as paid before deleting it.");
      return;
    }
    setDeleteConfirm(expense);
  };

  const doDelete = async (expense: Expense) => {
    setDeleting(d => ({ ...d, [expense.id]: true }));
    setExpenses(prev => prev.filter(e => e.id !== expense.id));
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, { method: "DELETE" });
      onMutated?.();
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

  // ─── Expense row ──────────────────────────────────────────────────────

  const resolvedColor = resolveCategoryColor(category?.color);

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
                resizeMode="contain"
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

  if (!visible && !category) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={ss.backdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View style={[ss.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        {/* Drag handle */}
        <View style={ss.handle} />

        {/* Header */}
        <View style={ss.header}>
          <View style={ss.headerLeft}>
            {category && <CategoryIcon name={category.icon} color={resolvedColor} />}
            <View>
              <Text style={ss.title} numberOfLines={1}>{category?.categoryName ?? ""}</Text>
              <Text style={ss.sub}>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month - 1]} {year}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={ss.closeBtn}>
            <Ionicons name="close" size={20} color={T.textDim} />
          </Pressable>
        </View>

        {/* Stats strip */}
        <View style={ss.statsRow}>
          <View style={ss.stat}>
            <Text style={ss.statLbl}>TOTAL</Text>
            <Text style={ss.statVal}>{fmt(totalAmount, currency)}</Text>
          </View>
          <View style={[ss.stat, { borderLeftWidth: 1, borderLeftColor: T.border }]}>
            <Text style={ss.statLbl}>PAID</Text>
            <Text style={[ss.statVal, { color: T.green }]}>{fmt(totalPaid, currency)}</Text>
          </View>
          <View style={[ss.stat, { borderLeftWidth: 1, borderLeftColor: T.border }]}>
            <Text style={ss.statLbl}>REMAINING</Text>
            <Text style={[ss.statVal, { color: T.orange }]}>{fmt(remaining, currency)}</Text>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={ss.center}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : error ? (
          <View style={ss.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={T.textDim} />
            <Text style={ss.errTxt}>{error}</Text>
            <Pressable onPress={load} style={ss.retryBtn}>
              <Text style={ss.retryTxt}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={e => e.id}
            contentContainerStyle={ss.list}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0f282f" />
            }
            ListEmptyComponent={
              <View style={ss.center}>
                <Ionicons name="receipt-outline" size={40} color="#1a3d3f" />
                <Text style={ss.emptyTxt}>No expenses in this category</Text>
              </View>
            }
            renderItem={renderItem}
          />
        )}
      </Animated.View>

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
          <View style={[es.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={es.handle} />
            <Text style={es.title}>Edit Expense</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={es.scrollContent} showsVerticalScrollIndicator={false}>
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
                returnKeyType="done"
                onSubmitEditing={handleEditSave}
              />

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

      <DeleteConfirmSheet
        visible={deleteConfirm !== null}
        title="Delete Expense"
        description={deleteConfirm ? `Delete "${deleteConfirm.name}"? This cannot be undone.` : ""}
        isBusy={!!(deleteConfirm && deleting[deleteConfirm.id])}
        onClose={() => {
          if (deleteConfirm && deleting[deleteConfirm.id]) return;
          setDeleteConfirm(null);
        }}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          const target = deleteConfirm;
          setDeleteConfirm(null);
          await doDelete(target);
        }}
      />
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Icon styles
const is = StyleSheet.create({
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconDot:  { width: 10, height: 10, borderRadius: 5 },
});

// Sheet styles
const ss = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    maxHeight: SCREEN_H * 0.88,
    backgroundColor: T.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: T.border,
    overflow: "hidden",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 10, marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  title: { color: T.text, fontSize: 16, fontWeight: "900" },
  sub:   { color: T.textDim, fontSize: 12, marginTop: 1, fontWeight: "600" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.cardAlt,
    alignItems: "center", justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },
  statLbl: { color: T.textDim, fontSize: 10, fontWeight: "700", marginBottom: 2 },
  statVal: { color: T.text, fontSize: 14, fontWeight: "900" },
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
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    overflow: "hidden",
  },
  logoImg: {
    width: 20,
    height: 20,
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
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: T.border,
    maxHeight: SCREEN_H * 0.9,
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
  scrollContent: { maxHeight: 620, marginBottom: 12 },
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
