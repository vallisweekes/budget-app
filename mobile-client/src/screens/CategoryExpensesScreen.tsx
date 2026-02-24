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
  Switch,
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
  const { categoryId, categoryName, color, icon, month, year, budgetPlanId, currency } = route.params;

  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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

  const load = useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}${qp}`);
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

  useEffect(() => {
    setLoading(true);
    setExpenses([]);
    load();
    loadCategories();
  }, [load, loadCategories]);

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

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={T.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <CategoryIcon name={icon} color={resolvedColor} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{categoryName}</Text>
            <Text style={styles.sub}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month - 1]} {year}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLbl}>TOTAL</Text>
          <Text style={styles.statVal}>{fmt(totalAmount, currency)}</Text>
        </View>
        <View style={[styles.stat, { borderLeftWidth: 1, borderLeftColor: T.border }]}>
          <Text style={styles.statLbl}>PAID</Text>
          <Text style={[styles.statVal, { color: T.green }]}>{fmt(totalPaid, currency)}</Text>
        </View>
        <View style={[styles.stat, { borderLeftWidth: 1, borderLeftColor: T.border }]}>
          <Text style={styles.statLbl}>REMAINING</Text>
          <Text style={[styles.statVal, { color: T.orange }]}>{fmt(remaining, currency)}</Text>
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
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[es.dateButtonText, !editState?.dueDate && es.dateButtonPlaceholder]}>
                  {editState?.dueDate ? new Date(editState.dueDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Select date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={T.accent} />
              </TouchableOpacity>
              {showDatePicker && (
                <View style={es.datePickerWrap}>
                  <DateTimePicker
                    value={editState?.dueDate ? new Date(editState.dueDate + 'T00:00:00') : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                      if (event.type === 'set' && selectedDate) {
                        const isoDate = selectedDate.toISOString().slice(0, 10);
                        setEditState(p => p ? { ...p, dueDate: isoDate } : p);
                      } else if (event.type === 'dismissed') {
                        setShowDatePicker(false);
                      }
                    }}
                    themeVariant="dark"
                  />
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity style={es.dateDoneBtn} onPress={() => setShowDatePicker(false)}>
                      <Text style={es.dateDoneTxt}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              <View style={es.switchRow}>
                <View style={es.switchInfo}>
                  <Text style={es.switchLabel}>Treat as allocation</Text>
                  <Text style={es.switchDesc}>Check if this is an allocation, not a monthly expense</Text>
                </View>
                <Switch
                  value={editState?.isAllocation ?? false}
                  onValueChange={v => setEditState(p => p ? { ...p, isAllocation: v } : p)}
                  trackColor={{ false: T.border, true: withOpacity(T.accent, 0.5) }}
                  thumbColor={editState?.isAllocation ? T.accent : T.textMuted}
                />
              </View>
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
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: T.border,
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
  scrollContent: { maxHeight: 400, marginBottom: 12 },
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
  dateDoneBtn: {
    alignSelf: "flex-end",
    margin: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: T.accent,
  },
  dateDoneTxt: { color: T.onAccent, fontSize: 12, fontWeight: "700" },
  switchRow: {
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
  },
  switchInfo: { flex: 1, marginRight: 12 },
  switchLabel: { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  switchDesc: { color: T.textDim, fontSize: 11 },
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
