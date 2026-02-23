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
import type { Income, Settings, IncomeMonthData } from "@/lib/apiTypes";
import type { IncomeStackParamList } from "@/navigation/types";
import { currencySymbol, fmt, MONTH_NAMES_LONG } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { useIncomeCRUD } from "@/lib/hooks/useIncomeCRUD";
import IncomeMonthStats from "@/components/Income/IncomeMonthStats";
import IncomeBarChart from "@/components/Income/IncomeBarChart";
import BillsSummary from "@/components/Income/BillsSummary";
import { IncomeRow, IncomeEditRow } from "@/components/Income/IncomeSourceItem";
import { IncomeAddForm } from "@/components/Income/IncomeAddForm";

type Props = NativeStackScreenProps<IncomeStackParamList, "IncomeMonth">;

export default function IncomeMonthScreen({ navigation, route }: Props) {
  const { month, year, budgetPlanId } = route.params;
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

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [monthData, incomeList, s] = await Promise.all([
        apiFetch<IncomeMonthData>(`/api/bff/income-month?month=${month}&year=${year}`),
        apiFetch<Income[]>(`/api/bff/income?month=${month}&year=${year}`),
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
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const crud = useIncomeCRUD({ month, year, budgetPlanId, currency, onReload: load });

  useEffect(() => {
    if (!isLocked) return;
    if (crud.showAddForm) crud.setShowAddForm(false);
    if (crud.editingId) crud.cancelEdit();
  }, [crud, isLocked]);

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
        </View>

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
                onDelete={!isLocked ? () => crud.handleDelete(item) : undefined}
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
