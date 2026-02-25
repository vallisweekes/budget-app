import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
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
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { useIncomeCRUD } from "@/lib/hooks/useIncomeCRUD";
import IncomeMonthHeader from "@/components/Income/IncomeMonthHeader";
import IncomeMonthIncomeList from "@/components/Income/IncomeMonthIncomeList";
import IncomeMonthSacrificeList from "@/components/Income/IncomeMonthSacrificeList";
import IncomeEditSheet from "@/components/Income/IncomeEditSheet";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import { s } from "./incomeMonthScreenStyles";

type Props = NativeStackScreenProps<IncomeStackParamList, "IncomeMonth">;

export default function IncomeMonthScreen({ navigation, route }: Props) {
  const topHeaderOffset = useTopHeaderOffset(-32);
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
        apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
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

  const crud = useIncomeCRUD({ month, year, budgetPlanId, onReload: load, setItems });

  const editingItem = crud.editingId ? items.find((i) => i.id === crud.editingId) ?? null : null;

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
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <IncomeMonthHeader
          monthLabel={monthLabel}
          isLocked={isLocked}
          viewMode={viewMode}
          showAddForm={crud.showAddForm}
          hideNavTitleRow
          onBack={() => navigation.goBack()}
          onToggleAdd={() => {
            if (isLocked) return;
            crud.setShowAddForm((v) => !v);
          }}
          onSetMode={setViewMode}
        />

        {viewMode === "sacrifice" ? (
          <IncomeMonthSacrificeList
            currency={currency}
            sacrifice={sacrifice}
            fixedDraft={fixedDraft}
            customDraftById={customDraftById}
            sacrificeSaving={sacrificeSaving}
            sacrificeCreating={sacrificeCreating}
            sacrificeDeletingId={sacrificeDeletingId}
            newSacrificeType={newSacrificeType}
            newSacrificeName={newSacrificeName}
            newSacrificeAmount={newSacrificeAmount}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([load(), loadSacrifice()]).finally(() => setRefreshing(false));
            }}
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
          <IncomeMonthIncomeList
            items={items}
            analysis={analysis}
            currency={currency}
            isLocked={isLocked}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            crud={crud}
          />
        )}

        <IncomeEditSheet
          visible={crud.editingId !== null}
          name={crud.editName}
          amount={crud.editAmount}
          currency={currency}
          totalIncome={items.reduce((sum, i) => sum + parseFloat(String(i.amount || "0")), 0)}
          setName={crud.setEditName}
          setAmount={crud.setEditAmount}
          saving={crud.saving}
          isLocked={isLocked}
          onCancel={crud.cancelEdit}
          onSave={() => {
            if (isLocked) return;
            crud.handleSaveEdit();
          }}
          onDelete={() => {
            if (!editingItem) return;
            crud.cancelEdit();
            setDeleteTarget(editingItem);
          }}
        />

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

