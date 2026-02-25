import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { IncomeSummaryData, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { T } from "@/lib/theme";
import IncomeMonthCard from "@/components/Income/IncomeMonthCard";
import type { IncomeStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<IncomeStackParamList, "IncomeGrid">;
type ScreenRoute = RouteProp<IncomeStackParamList, "IncomeGrid">;

export default function IncomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const now = new Date();
  const initialYear = Number.isFinite(Number(route.params?.year)) ? Number(route.params?.year) : now.getFullYear();
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<IncomeSummaryData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showYearAddSheet, setShowYearAddSheet] = useState(false);
  const [yearIncomeName, setYearIncomeName] = useState("");
  const [yearIncomeAmount, setYearIncomeAmount] = useState("");
  const [yearDistributeFullYear, setYearDistributeFullYear] = useState(false);
  const [yearDistributeHorizon, setYearDistributeHorizon] = useState(false);
  const [yearAddSaving, setYearAddSaving] = useState(false);

  const currency = currencySymbol(settings?.currency);

  useYearGuard(settings);

  useEffect(() => {
    const routeYear = Number(route.params?.year);
    if (Number.isFinite(routeYear) && routeYear !== year) {
      setYear(routeYear);
    }
  }, [route.params?.year, year]);

  useEffect(() => {
    if (!route.params?.openYearIncomeSheetAt) return;
    setYearDistributeFullYear(Boolean(settings?.incomeDistributeFullYearDefault));
    setYearDistributeHorizon(Boolean(settings?.incomeDistributeHorizonDefault));
    setShowYearAddSheet(true);
  }, [route.params?.openYearIncomeSheetAt, settings?.incomeDistributeFullYearDefault, settings?.incomeDistributeHorizonDefault]);

  useEffect(() => {
    if (!data) return;

    const currentMonthIndex = new Date().getMonth() + 1;

    const monthByIndex = new Map(data.months.map((month) => [month.monthIndex, month]));
    let firstMissingMonth: number | null = null;

    for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
      const month = monthByIndex.get(monthIndex);
      if (!month || month.total <= 0 || month.items.length === 0) {
        firstMissingMonth = monthIndex;
        break;
      }
    }

    const hasMissingMonths = firstMissingMonth !== null || data.monthsWithIncome < 12;

    navigation.setParams({
      year,
      showAddAction: hasMissingMonths,
      addIncomeMonth: firstMissingMonth ?? currentMonthIndex,
      budgetPlanId: data.budgetPlanId,
    });
  }, [data, navigation, year]);

  const getFirstMissingMonth = (summary: IncomeSummaryData | null): number | null => {
    if (!summary) return 1;
    const monthByIndex = new Map(summary.months.map((month) => [month.monthIndex, month]));
    for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
      const month = monthByIndex.get(monthIndex);
      if (!month || month.total <= 0 || month.items.length === 0) {
        return monthIndex;
      }
    }
    return null;
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [incData, s] = await Promise.all([
        apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setData(incData);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load income");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useFocusEffect(
    useCallback(() => { if (!loading) load(); }, [load, loading]),
  );

  const closeYearAddSheet = useCallback(() => {
    if (yearAddSaving) return;
    setShowYearAddSheet(false);
    setYearIncomeName("");
    setYearIncomeAmount("");
    navigation.setParams({ openYearIncomeSheetAt: undefined });
  }, [navigation, yearAddSaving]);

  const submitYearIncome = useCallback(async () => {
    const name = yearIncomeName.trim();
    const amount = Number(String(yearIncomeAmount).replace(/,/g, ""));
    const budgetPlanId = data?.budgetPlanId;

    if (!budgetPlanId) {
      Alert.alert("Missing budget plan", "Please try again after the screen reloads.");
      return;
    }
    if (!name) {
      Alert.alert("Missing name", "Please enter an income name.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount greater than 0.");
      return;
    }

    try {
      setYearAddSaving(true);
      await apiFetch("/api/bff/income", {
        method: "POST",
        body: {
          name,
          amount,
          month: 1,
          year,
          budgetPlanId,
          distributeFullYear: yearDistributeFullYear,
          distributeHorizon: yearDistributeHorizon,
        },
      });
      await load();
      closeYearAddSheet();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add income for year");
    } finally {
      setYearAddSaving(false);
    }
  }, [closeYearAddSheet, data?.budgetPlanId, load, year, yearDistributeFullYear, yearDistributeHorizon, yearIncomeAmount, yearIncomeName]);

  if (loading) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>Loading income…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const months = data?.months ?? [];
  const firstMissingMonth = getFirstMissingMonth(data);
  const hasMissingMonths = firstMissingMonth !== null || (data?.monthsWithIncome ?? 0) < 12;
  const nowMonthIndex = now.getMonth() + 1;
  const nowYear = now.getFullYear();

  return (
		<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
      {hasMissingMonths ? (
        <View style={s.actionCard}>
          <View style={s.actionCopy}>
            <Text style={s.actionTitle}>Add income</Text>
            <Text style={s.actionText}>Create an income item for this month.</Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={months}
        numColumns={2}
        keyExtractor={(item) => item.monthKey}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.gridRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
        }
        renderItem={({ item }) => {
          const isActive = year === nowYear && item.monthIndex === nowMonthIndex;
          const isLocked =
            year < nowYear || (year === nowYear && item.monthIndex < nowMonthIndex);
          return (
            <IncomeMonthCard
              item={item}
              currency={currency}
              fmt={fmt}
              active={isActive}
              locked={isLocked}
              onPress={() =>
                navigation.navigate("IncomeMonth", {
                  month: item.monthIndex,
                  year,
                  budgetPlanId: data?.budgetPlanId ?? "",
                  initialMode: "income",
                })
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>No income data for {year}</Text>
            <Text style={s.emptyHint}>Use the Add button above to create your first income.</Text>
          </View>
        }
      />

      <Modal
        visible={showYearAddSheet}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={closeYearAddSheet}
      >
        <KeyboardAvoidingView
          style={s.sheetOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={s.sheetBackdrop} onPress={closeYearAddSheet} />
          <View style={s.sheetCard}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeaderRow}>
              <Text style={s.sheetTitle}>Add income for {year}</Text>
              <Pressable onPress={closeYearAddSheet} style={s.sheetCloseBtn}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>
            <Text style={s.sheetSub}>Starts from January and applies using your selected options.</Text>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Income name</Text>
              <TextInput
                value={yearIncomeName}
                onChangeText={setYearIncomeName}
                placeholder="e.g. Salary"
                placeholderTextColor={T.textMuted}
                style={s.fieldInput}
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Amount</Text>
              <TextInput
                value={yearIncomeAmount}
                onChangeText={setYearIncomeAmount}
                keyboardType="decimal-pad"
                placeholder={`${currency}0.00`}
                placeholderTextColor={T.textMuted}
                style={s.fieldInput}
              />
            </View>

            <View style={s.toggleRow}>
              <View style={s.toggleCopy}>
                <Text style={s.toggleTitle}>Distribute for full year</Text>
                <Text style={s.toggleSub}>Apply this income from Jan to Dec for {year}</Text>
              </View>
              <Pressable
                onPress={() => setYearDistributeFullYear((v) => !v)}
                style={[s.toggle, yearDistributeFullYear && s.toggleOn]}
              >
                <View style={[s.toggleThumb, yearDistributeFullYear && s.toggleThumbOn]} />
              </Pressable>
            </View>

            <View style={s.toggleRow}>
              <View style={s.toggleCopy}>
                <Text style={s.toggleTitle}>Distribute through budget horizon</Text>
                <Text style={s.toggleSub}>Continue through the next {Math.max(1, settings?.budgetHorizonYears ?? 10)} years</Text>
              </View>
              <Pressable
                onPress={() => setYearDistributeHorizon((v) => !v)}
                style={[s.toggle, yearDistributeHorizon && s.toggleOn]}
              >
                <View style={[s.toggleThumb, yearDistributeHorizon && s.toggleThumbOn]} />
              </Pressable>
            </View>

            <Pressable onPress={submitYearIncome} style={[s.saveBtn, yearAddSaving && s.saveBtnDisabled]} disabled={yearAddSaving}>
              <Text style={s.saveBtnText}>{yearAddSaving ? "Saving..." : "Save income"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: T.textDim, marginTop: 8, fontSize: 14 },

  grid: { padding: 12, paddingBottom: 140 },
  gridRow: { gap: 10, marginBottom: 10 },
  actionCard: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  actionText: { marginTop: 2, color: T.textDim, fontSize: 12, fontWeight: "700" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: T.textDim, fontSize: 15, fontWeight: "700" },
  emptyHint: { color: T.textMuted, fontSize: 12, fontWeight: "600" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheetCard: {
    backgroundColor: T.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 2,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sheetSub: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "600",
    marginTop: -6,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
  },
  fieldInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    color: T.text,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleSub: {
    marginTop: 2,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  toggle: {
    width: 48,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.textMuted,
  },
  toggleThumbOn: {
    backgroundColor: T.onAccent,
    marginLeft: 18,
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: T.onAccent,
    fontSize: 15,
    fontWeight: "900",
  },
});
