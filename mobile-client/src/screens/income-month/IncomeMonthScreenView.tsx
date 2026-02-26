import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
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
  const [sacrificeSaving, setSacrificeSaving] = useState(false);
  const [sacrificeCreating, setSacrificeCreating] = useState(false);
  const [sacrificeDeletingId, setSacrificeDeletingId] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [confirmingTargetKey, setConfirmingTargetKey] = useState<string | null>(null);

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

  type SacrificePeriod =
    | "this_month"
    | "next_six_months"
    | "remaining_months"
    | "two_years"
    | "five_years"
    | "ten_years";

  type FixedField = keyof IncomeSacrificeFixed;

  const buildTargetMonths = useCallback((startMonth: number, startYear: number, period: SacrificePeriod) => {
    const safeMonth = Math.max(1, Math.min(12, Math.floor(startMonth)));
    const safeYear = Math.max(2000, Math.floor(startYear));
    const targets: Array<{ month: number; year: number }> = [];

    const pushSequence = (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const absolute = (safeMonth - 1) + index;
        const nextYear = safeYear + Math.floor(absolute / 12);
        const nextMonth = (absolute % 12) + 1;
        targets.push({ month: nextMonth, year: nextYear });
      }
    };

    if (period === "this_month") {
      pushSequence(1);
      return targets;
    }
    if (period === "next_six_months") {
      pushSequence(6);
      return targets;
    }
    if (period === "remaining_months") {
      pushSequence(12 - safeMonth + 1);
      return targets;
    }
    if (period === "two_years") {
      pushSequence(24);
      return targets;
    }
    if (period === "five_years") {
      pushSequence(60);
      return targets;
    }
    pushSequence(120);
    return targets;
  }, []);

  const applySacrificeAmount = useCallback(async (args: {
    targetType: "fixed" | "custom";
    fixedField?: FixedField;
    customAllocationId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
  }) => {
    const value = Number(args.amount);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than or equal to 0.");
      return;
    }

    if (args.targetType === "fixed" && !args.fixedField) {
      Alert.alert("Select sacrifice", "Pick a sacrifice type to update.");
      return;
    }
    if (args.targetType === "custom" && !args.customAllocationId) {
      Alert.alert("Select item", "Pick a custom sacrifice item to update.");
      return;
    }

    const targets = buildTargetMonths(args.startMonth, args.startYear, args.period);
    if (targets.length === 0) {
      Alert.alert("Invalid period", "No target months were generated.");
      return;
    }

    const affectsViewedMonth = targets.some((target) => target.month === month && target.year === year);
    const previousSacrifice = sacrifice;

    if (affectsViewedMonth && previousSacrifice) {
      const nextFixed: IncomeSacrificeFixed = {
        monthlyAllowance: Number(previousSacrifice.fixed.monthlyAllowance ?? 0),
        monthlySavingsContribution: Number(previousSacrifice.fixed.monthlySavingsContribution ?? 0),
        monthlyEmergencyContribution: Number(previousSacrifice.fixed.monthlyEmergencyContribution ?? 0),
        monthlyInvestmentContribution: Number(previousSacrifice.fixed.monthlyInvestmentContribution ?? 0),
      };

      let nextCustomItems = [...(previousSacrifice.customItems ?? [])];
      let nextCustomTotal = Number(previousSacrifice.customTotal ?? 0);

      if (args.targetType === "fixed") {
        nextFixed[args.fixedField as FixedField] = value;
      } else {
        const targetId = args.customAllocationId as string;
        nextCustomItems = nextCustomItems.map((item) => {
          if (item.id !== targetId) return item;
          const oldAmount = Number(item.amount ?? 0);
          const newAmount = value;
          nextCustomTotal += newAmount - oldAmount;
          return { ...item, amount: newAmount };
        });
      }

      const fixedTotal =
        Number(nextFixed.monthlyAllowance ?? 0) +
        Number(nextFixed.monthlySavingsContribution ?? 0) +
        Number(nextFixed.monthlyEmergencyContribution ?? 0) +
        Number(nextFixed.monthlyInvestmentContribution ?? 0);

      setSacrifice({
        ...previousSacrifice,
        fixed: nextFixed,
        customItems: nextCustomItems,
        customTotal: nextCustomTotal,
        totalSacrifice: fixedTotal + nextCustomTotal,
      });
    }

    try {
      setSacrificeSaving(true);
      for (const target of targets) {
        const snapshot = await apiFetch<IncomeSacrificeData>(
          `/api/bff/income-sacrifice?month=${target.month}&year=${target.year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
        );

        if (args.targetType === "fixed") {
          const nextFixed: IncomeSacrificeFixed = {
            monthlyAllowance: Number(snapshot.fixed.monthlyAllowance ?? 0),
            monthlySavingsContribution: Number(snapshot.fixed.monthlySavingsContribution ?? 0),
            monthlyEmergencyContribution: Number(snapshot.fixed.monthlyEmergencyContribution ?? 0),
            monthlyInvestmentContribution: Number(snapshot.fixed.monthlyInvestmentContribution ?? 0),
          };
          nextFixed[args.fixedField as FixedField] = value;

          await apiFetch("/api/bff/income-sacrifice", {
            method: "PATCH",
            body: {
              budgetPlanId,
              month: target.month,
              year: target.year,
              fixed: nextFixed,
            },
          });
        } else {
          await apiFetch("/api/bff/income-sacrifice", {
            method: "PATCH",
            body: {
              budgetPlanId,
              month: target.month,
              year: target.year,
              fixed: snapshot.fixed,
              customAmountById: {
                [args.customAllocationId as string]: value,
              },
            },
          });
        }
      }

      await Promise.all([loadSacrifice(), load()]);
    } catch (error) {
      if (affectsViewedMonth && previousSacrifice) {
        setSacrifice(previousSacrifice);
      }
      Alert.alert("Could not save sacrifice", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSacrificeSaving(false);
    }
  }, [budgetPlanId, buildTargetMonths, load, loadSacrifice, month, sacrifice, year]);

  const createSacrificeItem = useCallback(async (args: {
    type: "allowance" | "savings" | "emergency" | "investment" | "custom";
    name: string;
  }) => {
    const trimmedName = args.name.trim();
    if (args.type === "custom" && !trimmedName) {
      Alert.alert("Name required", "Custom sacrifice requires a name.");
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
          type: args.type,
          name: trimmedName,
          amount: 0,
        },
      });
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeCreating(false);
    }
  }, [budgetPlanId, load, loadSacrifice, month, year]);

  const deleteSacrificeItem = async (id: string) => {
    try {
      setSacrificeDeletingId(id);
      await apiFetch(`/api/bff/income-sacrifice/custom/${id}`, { method: "DELETE" });
      await Promise.all([loadSacrifice(), load()]);
    } finally {
      setSacrificeDeletingId(null);
    }
  };

  const saveSacrificeGoalLink = useCallback(async (args: { targetKey: string; goalId: string | null }) => {
    if (!args.targetKey.trim()) {
      Alert.alert("Link target", "Pick a sacrifice target first.");
      return;
    }

    try {
      setLinkSaving(true);
      await apiFetch("/api/bff/income-sacrifice/goals", {
        method: "PATCH",
        body: {
          budgetPlanId,
          targetKey: args.targetKey,
          goalId: args.goalId,
        },
      });
      await loadSacrifice();
    } catch (error) {
      Alert.alert("Could not save link", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLinkSaving(false);
    }
  }, [budgetPlanId, loadSacrifice]);

  const confirmSacrificeTransfer = useCallback(async (targetKey: string) => {
    if (!targetKey.trim()) return;

    try {
      setConfirmingTargetKey(targetKey);
      await apiFetch("/api/bff/income-sacrifice/goals", {
        method: "POST",
        body: {
          budgetPlanId,
          month,
          year,
          targetKey,
        },
      });
      await Promise.all([loadSacrifice(), load()]);
      Alert.alert("Confirmed", "Transfer confirmed and goal progress updated.");
    } catch (error) {
      Alert.alert("Could not confirm", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setConfirmingTargetKey(null);
    }
  }, [budgetPlanId, load, loadSacrifice, month, year]);

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
            month={month}
            year={year}
            sacrifice={sacrifice}
            sacrificeSaving={sacrificeSaving}
            sacrificeCreating={sacrificeCreating}
            sacrificeDeletingId={sacrificeDeletingId}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([load(), loadSacrifice()]).finally(() => setRefreshing(false));
            }}
            onApplySacrificeAmount={applySacrificeAmount}
            onDeleteCustom={deleteSacrificeItem}
            onCreateItem={createSacrificeItem}
            onSaveGoalLink={saveSacrificeGoalLink}
            onConfirmTransfer={confirmSacrificeTransfer}
            goalLinkSaving={linkSaving}
            confirmingTargetKey={confirmingTargetKey}
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

