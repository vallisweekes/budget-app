import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { Income, Settings, IncomeMonthData, IncomeSacrificeData, IncomeSacrificeFixed } from "@/lib/apiTypes";
import type { IncomeStackParamList } from "@/navigation/types";
import { currencySymbol, fmt, MONTH_NAMES_LONG } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { useIncomeCRUD } from "@/lib/hooks/useIncomeCRUD";
import IncomeMonthStats from "@/components/Income/IncomeMonthStats";
import IncomeBarChart from "@/components/Income/IncomeBarChart";
import BillsSummary from "@/components/Income/BillsSummary";
import { IncomeRow, IncomeEditRow } from "@/components/Income/IncomeSourceItem";
import { IncomeAddForm } from "@/components/Income/IncomeAddForm";
import IncomeSacrificeEditor from "@/components/Income/IncomeSacrificeEditor";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";

type Props = NativeStackScreenProps<IncomeStackParamList, "IncomeMonth">;

export default function IncomeMonthScreen({ navigation, route }: Props) {
  const { month, year, budgetPlanId, initialMode } = route.params;
  const monthLabel = `${MONTH_NAMES_LONG[month - 1]} ${year}`;

  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();
  const isLocked = year < nowYear || (year === nowYear && month < nowMonth);

  const [analysis, setAnalysis] = useState<IncomeMonthData | null>(null);
  const [items, setItems]       = useState<Income[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [viewMode, setViewMode] = useState<"income" | "sacrifice">(initialMode ?? "income");
  const [sacrifice, setSacrifice] = useState<IncomeSacrificeData | null>(null);
  const [fixedDraft, setFixedDraft] = useState<IncomeSacrificeFixed>({
    monthlyAllowance: 0,
    monthlySavingsContribution: 0,
    monthlyEmergencyContribution: 0,
    monthlyInvestmentContribution: 0,
  });
  const [customDraftById, setCustomDraftById] = useState<Record<string, string>>({});
  const [sacrificeSaving, setSacrificeSaving] = useState(false);
  const [sacrificeCreating, setSacrificeCreating] = useState(false);
  const [sacrificeDeletingId, setSacrificeDeletingId] = useState<string | null>(null);
  const [newSacrificeType, setNewSacrificeType] = useState<"allowance" | "savings" | "emergency" | "investment" | "custom">("custom");
  const [newSacrificeName, setNewSacrificeName] = useState("");
  const [newSacrificeAmount, setNewSacrificeAmount] = useState("");

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [monthData, incomeList, s] = await Promise.all([
        apiFetch<IncomeMonthData>(`/api/bff/income-month?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
        apiFetch<Income[]>(`/api/bff/income?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setAnalysis(monthData);
      setItems(Array.isArray(incomeList) ? incomeList : []);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, budgetPlanId]);

  const loadSacrifice = useCallback(async () => {
    const data = await apiFetch<IncomeSacrificeData>(
      `/api/bff/income-sacrifice?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
    );
    setSacrifice(data);
    setFixedDraft(data.fixed);
    setCustomDraftById(Object.fromEntries((data.customItems ?? []).map((item) => [item.id, String(item.amount)])));
  }, [month, year, budgetPlanId]);

  useEffect(() => {
    load();
    loadSacrifice().catch(() => null);
  }, [load, loadSacrifice]);

  const crud = useIncomeCRUD({ month, year, budgetPlanId, onReload: load });

  useEffect(() => {
    if (!isLocked) return;
    if (crud.showAddForm) crud.setShowAddForm(false);
    if (crud.editingId) crud.cancelEdit();
  }, [crud, isLocked]);

  useEffect(() => {
    setViewMode(initialMode ?? "income");
  }, [initialMode, month, year]);

  const saveFixedSacrifice = async () => {
    try {
      setSacrificeSaving(true);
      await apiFetch("/api/bff/income-sacrifice", {
        method: "PATCH",
        body: {
          budgetPlanId,
          month,
          year,
          fixed: {
            monthlyAllowance: Number(fixedDraft.monthlyAllowance) || 0,
            monthlySavingsContribution: Number(fixedDraft.monthlySavingsContribution) || 0,
            monthlyEmergencyContribution: Number(fixedDraft.monthlyEmergencyContribution) || 0,
            monthlyInvestmentContribution: Number(fixedDraft.monthlyInvestmentContribution) || 0,
          },
        },
      });
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeSaving(false);
    }
  };

  const saveCustomSacrificeAmounts = async () => {
    try {
      setSacrificeSaving(true);
      await apiFetch("/api/bff/income-sacrifice", {
        method: "PATCH",
        body: {
          budgetPlanId,
          month,
          year,
          fixed: fixedDraft,
          customAmountById: Object.fromEntries(Object.entries(customDraftById).map(([id, value]) => [id, Number(value) || 0])),
        },
      });
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeSaving(false);
    }
  };

  const createSacrificeItem = async () => {
    if (newSacrificeType === "custom" && !newSacrificeName.trim()) {
      setError("Custom sacrifice requires a name.");
      return;
    }
    try {
      setSacrificeCreating(true);
      await apiFetch("/api/bff/income-sacrifice/custom", {
        method: "POST",
        body: {
          budgetPlanId,
          month,
          year,
          type: newSacrificeType,
          name: newSacrificeName.trim(),
          amount: Number(newSacrificeAmount) || 0,
        },
      });
      setNewSacrificeName("");
      setNewSacrificeAmount("");
      setNewSacrificeType("custom");
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeCreating(false);
    }
  };

  const deleteSacrificeItem = async (id: string) => {
    try {
      setSacrificeDeletingId(id);
      await apiFetch(`/api/bff/income-sacrifice/custom/${id}`, { method: "DELETE" });
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeDeletingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <Text style={s.headerTitle}>{monthLabel}</Text>
          {viewMode === "income" ? (
            <Pressable
              onPress={() => {
                if (isLocked) return;
                crud.setShowAddForm((v) => !v);
              }}
              style={s.addBtn}
              hitSlop={8}
              disabled={isLocked}
            >
              <Ionicons
                name={isLocked ? "lock-closed-outline" : crud.showAddForm ? "close" : "add-circle-outline"}
                size={22}
                color={isLocked ? T.textMuted : T.text}
              />
            </Pressable>
          ) : <View style={s.addBtn} />}
        </View>

        <View style={s.modeWrap}>
          <Pressable style={[s.modePill, viewMode === "income" && s.modePillActive]} onPress={() => setViewMode("income")}>
            <Text style={[s.modeTxt, viewMode === "income" && s.modeTxtActive]}>Income</Text>
          </Pressable>
          <Pressable style={[s.modePill, viewMode === "sacrifice" && s.modePillActive]} onPress={() => setViewMode("sacrifice")}>
            <Text style={[s.modeTxt, viewMode === "sacrifice" && s.modeTxtActive]}>Income sacrifice</Text>
          </Pressable>
        </View>

        {viewMode === "sacrifice" ? (
          <FlatList
            data={[]}
            keyExtractor={(_, idx) => String(idx)}
            contentContainerStyle={s.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); Promise.all([load(), loadSacrifice()]).finally(() => setRefreshing(false)); }} tintColor={T.accent} />
            }
            ListHeaderComponent={
              sacrifice ? (
                <IncomeSacrificeEditor
                  currency={currency}
                  fixed={fixedDraft}
                  customItems={sacrifice.customItems}
                  customTotal={sacrifice.customTotal}
                  totalSacrifice={sacrifice.totalSacrifice}
                  saving={sacrificeSaving}
                  creating={sacrificeCreating}
                  deletingId={sacrificeDeletingId}
                  newType={newSacrificeType}
                  newName={newSacrificeName}
                  newAmount={newSacrificeAmount}
                  onChangeFixed={(key, value) => setFixedDraft((prev) => ({ ...prev, [key]: Number(value) || 0 }))}
                  onSaveFixed={saveFixedSacrifice}
                  onChangeCustomAmount={(id, value) => setCustomDraftById((prev) => ({ ...prev, [id]: value }))}
                  onSaveCustomAmounts={saveCustomSacrificeAmounts}
                  onDeleteCustom={deleteSacrificeItem}
                  onSetNewType={setNewSacrificeType}
                  onSetNewName={setNewSacrificeName}
                  onSetNewAmount={setNewSacrificeAmount}
                  onCreateCustom={createSacrificeItem}
                />
              ) : (
                <View style={s.center}><ActivityIndicator size="small" color={T.accent} /></View>
              )
            }
            ListEmptyComponent={null}
            renderItem={() => null}
          />
        ) : (

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
          }
          ListHeaderComponent={
            <>
              {analysis && <IncomeMonthStats data={analysis} currency={currency} fmt={fmt} />}
              {analysis && <IncomeBarChart data={analysis} currency={currency} />}
              {analysis && <BillsSummary data={analysis} currency={currency} fmt={fmt} />}

              <View style={s.sourcesHeader}>
                <Text style={s.sourcesTitle}>Income sources</Text>
                <Text style={s.sourcesSub}>
                  {isLocked ? "Past month — view only." : "Add, edit, or remove income for this month."}
                </Text>
              </View>

              {!isLocked && crud.showAddForm && (
                <IncomeAddForm
                  name={crud.newName}
                  amount={crud.newAmount}
                  setName={crud.setNewName}
                  setAmount={crud.setNewAmount}
                  distributeMonths={crud.distributeMonths}
                  setDistributeMonths={crud.setDistributeMonths}
                  distributeYears={crud.distributeYears}
                  setDistributeYears={crud.setDistributeYears}
                  onAdd={crud.handleAdd}
                  saving={crud.saving}
                />
              )}
            </>
          }
          renderItem={({ item }) =>
            !isLocked && crud.editingId === item.id ? (
              <IncomeEditRow
                editName={crud.editName}
                editAmount={crud.editAmount}
                setEditName={crud.setEditName}
                setEditAmount={crud.setEditAmount}
                onSave={crud.handleSaveEdit}
                onCancel={crud.cancelEdit}
                saving={crud.saving}
              />
            ) : (
              <IncomeRow
                item={item}
                currency={currency}
                fmt={fmt}
                onEdit={!isLocked ? () => crud.startEdit(item) : undefined}
                onDelete={!isLocked ? () => setDeleteTarget(item) : undefined}
              />
            )
          }
          ListEmptyComponent={
            !crud.showAddForm ? (
              <View style={s.empty}>
                <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
                <Text style={s.emptyText}>No income sources yet</Text>
                {!isLocked && <Text style={s.emptySub}>Tap + to add your first source</Text>}
              </View>
            ) : null
          }
        />
        )}

        <DeleteConfirmSheet
          visible={deleteTarget !== null}
          title="Delete income"
          description={deleteTarget ? `Remove "${deleteTarget.name}" (${fmt(deleteTarget.amount, currency)})?` : ""}
          isBusy={crud.deletingId === deleteTarget?.id}
          onClose={() => {
            if (crud.deletingId) return;
            setDeleteTarget(null);
          }}
          onConfirm={async () => {
            if (!deleteTarget) return;
            await crud.deleteIncome(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { padding: 4 },
  addBtn: { padding: 4 },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "900", flex: 1, textAlign: "center" },
  modeWrap: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    padding: 4,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: T.accent,
  },
  modeTxt: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  modeTxtActive: {
    color: T.onAccent,
  },
  sourcesHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sourcesTitle: { color: T.text, fontSize: 15, fontWeight: "900" },
  sourcesSub: { color: T.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyText: { color: T.text, fontSize: 15, fontWeight: "800" },
  emptySub: { color: T.textDim, fontSize: 13, fontWeight: "600" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
