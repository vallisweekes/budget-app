import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";

import { s } from "@/components/IncomeScreen/style";
import { apiFetch } from "@/lib/api";
import type { IncomeSummaryData } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { MONTH_NAMES_SHORT } from "@/lib/constants";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useSwipeDownToClose, useTopHeaderOffset, useYearGuard } from "@/hooks";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import IncomeMonthCard from "@/components/Income/IncomeMonthCard";
import MoneyInput from "@/components/Shared/MoneyInput";
import type { IncomeScreenNavigation, IncomeScreenRoute } from "@/types";

export default function IncomeScreen() {
  const navigation = useNavigation<IncomeScreenNavigation>();
  const route = useRoute<IncomeScreenRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const contentTopPadding = topHeaderOffset + 10;
  const now = new Date();
  const initialYear = Number.isFinite(Number(route.params?.year)) ? Number(route.params?.year) : now.getFullYear();
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<IncomeSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showYearAddSheet, setShowYearAddSheet] = useState(false);
  const [yearIncomeName, setYearIncomeName] = useState("");
  const [yearIncomeAmount, setYearIncomeAmount] = useState("");
  const [yearDistributeFullYear, setYearDistributeFullYear] = useState(false);
  const [yearDistributeHorizon, setYearDistributeHorizon] = useState(false);
  const [yearAddSaving, setYearAddSaving] = useState(false);
  const skipNextTabFocusReloadRef = useRef(false);

  const {
    settings,
    isLoading: bootstrapLoading,
    error: bootstrapError,
    refresh: refreshBootstrap,
    ensureLoaded,
  } = useBootstrapData();

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
    if (year < new Date().getFullYear()) {
      navigation.setParams({ openYearIncomeSheetAt: undefined });
      return;
    }
    setYearDistributeFullYear(Boolean(settings?.incomeDistributeFullYearDefault));
    setYearDistributeHorizon(Boolean(settings?.incomeDistributeHorizonDefault));
    setShowYearAddSheet(true);
  }, [navigation, route.params?.openYearIncomeSheetAt, settings?.incomeDistributeFullYearDefault, settings?.incomeDistributeHorizonDefault, year]);

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
    const canAddForYear = year >= new Date().getFullYear();

    const nextShowAddAction = hasMissingMonths && canAddForYear;
    const nextAddIncomeMonth = firstMissingMonth ?? currentMonthIndex;
    const currentYear = Number(route.params?.year);
    const currentShowAddAction = typeof route.params?.showAddAction === "boolean" ? route.params.showAddAction : undefined;
    const currentAddIncomeMonth = Number(route.params?.addIncomeMonth);
    const currentBudgetPlanId = typeof route.params?.budgetPlanId === "string" ? route.params.budgetPlanId : "";

    const yearChanged = !(Number.isFinite(currentYear) && currentYear === year);
    const showAddActionChanged = currentShowAddAction !== nextShowAddAction;
    const addIncomeMonthChanged = !(Number.isFinite(currentAddIncomeMonth) && currentAddIncomeMonth === nextAddIncomeMonth);
    const budgetPlanChanged = currentBudgetPlanId !== data.budgetPlanId;

    if (!yearChanged && !showAddActionChanged && !addIncomeMonthChanged && !budgetPlanChanged) return;

    navigation.setParams({
      year,
      showAddAction: nextShowAddAction,
      addIncomeMonth: nextAddIncomeMonth,
      budgetPlanId: data.budgetPlanId,
    });
  }, [data, navigation, route.params?.addIncomeMonth, route.params?.budgetPlanId, route.params?.showAddAction, route.params?.year, year]);

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
      const { settings: loadedSettings } = refreshing
        ? await refreshBootstrap({ force: true })
        : await ensureLoaded();

      if (!loadedSettings) {
        throw bootstrapError ?? new Error("Failed to load settings");
      }

      const incData = await apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`);
      setData(incData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load income");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bootstrapError, ensureLoaded, refreshBootstrap, refreshing, year]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    const tabNavigation = navigation.getParent();
    if (!tabNavigation) return;

    const unsubscribe = tabNavigation.addListener("blur", () => {
      skipNextTabFocusReloadRef.current = true;
    });

    return unsubscribe;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextTabFocusReloadRef.current) {
        skipNextTabFocusReloadRef.current = false;
        return;
      }
      if (!loading) load();
    }, [load, loading]),
  );

  const closeYearAddSheet = useCallback(() => {
    if (yearAddSaving) return;
    setShowYearAddSheet(false);
    setYearIncomeName("");
    setYearIncomeAmount("");
    navigation.setParams({ openYearIncomeSheetAt: undefined });
  }, [navigation, yearAddSaving]);

  const { dragY: yearAddDragY, panHandlers: yearAddPanHandlers, resetDrag: resetYearAddDrag } = useSwipeDownToClose({
    onClose: closeYearAddSheet,
    disabled: yearAddSaving,
  });

  useEffect(() => {
    if (showYearAddSheet) {
      resetYearAddDrag();
    }
  }, [resetYearAddDrag, showYearAddSheet]);

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

  const months = data?.months ?? [];
  const payFrequency = normalizePayFrequency(settings?.payFrequency);
  const displayMonths = React.useMemo(() => {
    if (payFrequency !== "monthly") return months;

    // For monthly pay periods, the server's `monthIndex` is the *anchor/end month*.
    // Convert that to a cycle index where Jan–Feb = 1, Feb–Mar = 2, ..., Dec–Jan = 12.
    const cycleIndexForAnchorMonth = (anchorMonth: number) => (anchorMonth === 1 ? 12 : anchorMonth - 1);

    return [...months].sort((a, b) => {
      const aCycle = cycleIndexForAnchorMonth(a.monthIndex);
      const bCycle = cycleIndexForAnchorMonth(b.monthIndex);
      return aCycle - bCycle;
    });
  }, [months, payFrequency]);

  if (bootstrapLoading || loading) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: contentTopPadding }]} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>Loading income…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: contentTopPadding }]} edges={[]}>
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

  const firstMissingMonth = getFirstMissingMonth(data);
  const hasMissingMonths = firstMissingMonth !== null || (data?.monthsWithIncome ?? 0) < 12;
  const activePayPeriod = resolveActivePayPeriod({
    now,
    payDate: settings?.payDate ?? 27,
    payFrequency,
    planCreatedAt: settings?.setupCompletedAt
      ? new Date(settings.setupCompletedAt)
      : settings?.accountCreatedAt
        ? new Date(settings.accountCreatedAt)
        : null,
  });
  const activePeriodAnchor = getPayPeriodAnchorFromWindow({ period: activePayPeriod, payFrequency });
  const activePeriodAnchorMonth = activePeriodAnchor.month;
  const activePeriodAnchorYear = activePeriodAnchor.year;
  const nowYear = now.getFullYear();
  const canAddForYear = year >= nowYear;

  return (
  		<SafeAreaView style={[s.safe, { paddingTop: contentTopPadding }]} edges={[]}>
      {hasMissingMonths && canAddForYear ? (
        <View style={s.actionCard}>
          <View style={s.actionCopy}>
            <Text style={s.actionTitle}>Add income</Text>
            <Text style={s.actionText}>Create an income item for this month.</Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={displayMonths}
        numColumns={2}
        keyExtractor={(item) => item.monthKey}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.gridRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
        }
        renderItem={({ item }) => {
          const isActive = year === activePeriodAnchorYear && item.monthIndex === activePeriodAnchorMonth;
          const hasBudgetPlanId = typeof data?.budgetPlanId === "string" && data.budgetPlanId.trim().length > 0;
          const period = buildPayPeriodFromMonthAnchor({
            year,
            month: item.monthIndex,
            payDate: settings?.payDate ?? 27,
            payFrequency,
          });
          const periodEndAt = new Date(period.end.getTime());
          periodEndAt.setHours(23, 59, 59, 999);
          const isLocked = periodEndAt.getTime() < now.getTime();
          const periodLabel = `${MONTH_NAMES_SHORT[period.start.getMonth()]} - ${MONTH_NAMES_SHORT[period.end.getMonth()]}`;
          return (
            <IncomeMonthCard
              item={item}
              currency={currency}
              fmt={fmt}
              active={isActive}
              locked={isLocked}
              periodLabel={periodLabel}
              onPress={() => {
                if (!hasBudgetPlanId) {
                  Alert.alert("Income unavailable", "Budget plan is still syncing. Please pull to refresh and try again.");
                  return;
                }

                navigation.navigate("IncomeMonth", {
                  month: item.monthIndex,
                  year,
                  budgetPlanId: data.budgetPlanId,
                  initialMode: "income",
                });
              }}
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
          <Animated.View style={[s.sheetCard, { transform: [{ translateY: yearAddDragY }] }]}>
            <View style={s.sheetHandle} {...yearAddPanHandlers} />
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
              <MoneyInput
                currency={settings?.currency}
                value={yearIncomeAmount}
                onChangeValue={setYearIncomeAmount}
                placeholder={`${currency}0.00`}
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
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
