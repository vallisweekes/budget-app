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
import { useNavigation, useFocusEffect, useIsFocused, useRoute } from "@react-navigation/native";

import { s } from "@/components/IncomeScreen/style";
import { apiFetch, getApiMutationVersion } from "@/lib/api";
import type { IncomeSummaryData } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { SCREEN_FOCUS_REVALIDATE_TTL_MS } from "@/lib/constants";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useAppLocale, usePayPeriodBoundaryRefresh, useSwipeDownToClose, useTopHeaderOffset, useYearGuard } from "@/hooks";
import { resolveDisplayedPayPeriodAnchor } from "@/lib/helpers/resolveDisplayedPayPeriodAnchor";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import IncomeMonthCard from "@/components/Income/IncomeMonthCard";
import MoneyInput from "@/components/Shared/MoneyInput";
import { getMobileApiErrorMessage, useCreateIncomeMutation } from "@/store/api";
import type { IncomeScreenNavigation, IncomeScreenRoute } from "@/types";

export default function IncomeScreen() {
  const navigation = useNavigation<IncomeScreenNavigation>();
  const route = useRoute<IncomeScreenRoute>();
  const isFocused = useIsFocused();
  const topHeaderOffset = useTopHeaderOffset();
  const contentTopPadding = topHeaderOffset + 10;
  const now = new Date();
  const initialYear = Number.isFinite(Number(route.params?.year)) ? Number(route.params?.year) : now.getFullYear();
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<IncomeSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedActiveAnchor, setDisplayedActiveAnchor] = useState<{ month: number; year: number } | null>(null);
  const [showYearAddSheet, setShowYearAddSheet] = useState(false);
  const [yearIncomeName, setYearIncomeName] = useState("");
  const [yearIncomeAmount, setYearIncomeAmount] = useState("");
  const [yearDistributeFullYear, setYearDistributeFullYear] = useState(false);
  const [yearDistributeHorizon, setYearDistributeHorizon] = useState(false);
  const [yearAddSaving, setYearAddSaving] = useState(false);
  const [createIncome] = useCreateIncomeMutation();
  const skipNextTabFocusReloadRef = useRef(false);
  const hasLoadedIncomeRef = useRef(false);
  const lastLoadedAtRef = useRef<number | null>(null);
  const seenMutationVersionRef = useRef<number>(getApiMutationVersion());

  const {
    settings,
    isLoading: bootstrapLoading,
    error: bootstrapError,
    refresh: refreshBootstrap,
    ensureLoaded,
  } = useBootstrapData();

  const currency = currencySymbol(settings?.currency);
  const { locale } = useAppLocale();

  const { minMonth, minYear } = useYearGuard(settings);
  const payFrequency = normalizePayFrequency(settings?.payFrequency);
  const payAnchorDate = payFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null);
  const planCreatedAt = React.useMemo(() => {
    const raw = settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? null;
    if (!raw) return null;

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [settings?.accountCreatedAt, settings?.setupCompletedAt]);
  const activePeriodAnchor = React.useMemo(() => {
    const activePayPeriod = resolveActivePayPeriod({
      now: new Date(),
      payDate: settings?.payDate ?? 27,
      payFrequency,
      payAnchorDate,
      planCreatedAt,
    });

    return getPayPeriodAnchorFromWindow({ period: activePayPeriod, payFrequency });
  }, [payAnchorDate, payFrequency, planCreatedAt, settings?.payDate]);
  const boundaryBudgetPlanId = typeof data?.budgetPlanId === "string" && data.budgetPlanId.trim().length > 0
    ? data.budgetPlanId
    : (typeof settings?.id === "string" ? settings.id : "");
  const payPeriodBoundaryVersion = usePayPeriodBoundaryRefresh({
    enabled: Boolean(isFocused && boundaryBudgetPlanId),
    identityKey: [
      boundaryBudgetPlanId,
      settings?.payDate ?? 27,
      payFrequency,
      payAnchorDate ?? "",
      settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? "",
    ].join("|"),
    payDate: settings?.payDate ?? 27,
    payFrequency,
    payAnchorDate,
    planCreatedAt,
  });

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

    const currentMonthIndex = displayedActiveAnchor?.month ?? (new Date().getMonth() + 1);

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
  }, [data, displayedActiveAnchor?.month, navigation, route.params?.addIncomeMonth, route.params?.budgetPlanId, route.params?.showAddAction, route.params?.year, year]);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);
      const shouldForce = options?.force === true || refreshing;
      const { settings: loadedSettings } = shouldForce
        ? await refreshBootstrap({ force: true })
        : await ensureLoaded();

      if (!loadedSettings) {
        throw bootstrapError ?? new Error("Failed to load settings");
      }

      const incData = await apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`);
      setData(incData);

      const payFrequency = normalizePayFrequency(loadedSettings?.payFrequency);
      const payAnchorDate = payFrequency === "monthly" ? null : (loadedSettings?.payAnchorDate ?? null);
      const nextDisplayedAnchor = await resolveDisplayedPayPeriodAnchor({
        budgetPlanId: incData.budgetPlanId,
        payDate: loadedSettings?.payDate ?? 27,
        payAnchorDate,
        payFrequency,
        planCreatedAt: loadedSettings?.setupCompletedAt
          ? new Date(loadedSettings.setupCompletedAt)
          : loadedSettings?.accountCreatedAt
            ? new Date(loadedSettings.accountCreatedAt)
            : null,
      });
      setDisplayedActiveAnchor(nextDisplayedAnchor);
      hasLoadedIncomeRef.current = true;
      lastLoadedAtRef.current = Date.now();
      seenMutationVersionRef.current = getApiMutationVersion();
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

  useEffect(() => {
    if (!payPeriodBoundaryVersion) return;

    const activeAnchorChanged = Boolean(
      displayedActiveAnchor
      && (
        displayedActiveAnchor.month !== activePeriodAnchor.month
        || displayedActiveAnchor.year !== activePeriodAnchor.year
      )
    );
    const shouldMoveToNextYear = activeAnchorChanged
      && year === displayedActiveAnchor?.year
      && year !== activePeriodAnchor.year;

    if (shouldMoveToNextYear) {
      setRefreshing(true);
      setYear(activePeriodAnchor.year);
      navigation.setParams({ year: activePeriodAnchor.year });
      return;
    }

    setRefreshing(true);
    void load({ force: true });
  }, [activePeriodAnchor.month, activePeriodAnchor.year, displayedActiveAnchor?.month, displayedActiveAnchor?.year, load, navigation, payPeriodBoundaryVersion, year]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextTabFocusReloadRef.current) {
        skipNextTabFocusReloadRef.current = false;
        return;
      }

      const latestMutationVersion = getApiMutationVersion();
      const hasMutationChanges = latestMutationVersion !== seenMutationVersionRef.current;
      const hasFreshIncome = hasLoadedIncomeRef.current
        && lastLoadedAtRef.current !== null
        && (Date.now() - lastLoadedAtRef.current) < SCREEN_FOCUS_REVALIDATE_TTL_MS;

      if (!hasMutationChanges && hasFreshIncome) {
        return;
      }

      if (!loading || hasMutationChanges) {
        void load({ force: hasMutationChanges });
      }
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
      await createIncome({
        name,
        amount,
        month: 1,
        year,
        budgetPlanId,
        distributeFullYear: yearDistributeFullYear,
        distributeHorizon: yearDistributeHorizon,
      }).unwrap();
      await load();
      closeYearAddSheet();
    } catch (err: unknown) {
      Alert.alert("Error", getMobileApiErrorMessage(err, "Could not add income for year"));
    } finally {
      setYearAddSaving(false);
    }
  }, [closeYearAddSheet, createIncome, data?.budgetPlanId, load, year, yearDistributeFullYear, yearDistributeHorizon, yearIncomeAmount, yearIncomeName]);

  const displayMonths = React.useMemo(() => {
    const months = data?.months ?? [];
    if (payFrequency !== "monthly") return months;

    // For monthly pay periods, the server's `monthIndex` is the *anchor/end month*.
    // Convert that to a cycle index where Jan–Feb = 1, Feb–Mar = 2, ..., Dec–Jan = 12.
    const cycleIndexForAnchorMonth = (anchorMonth: number) => (anchorMonth === 1 ? 12 : anchorMonth - 1);

    return [...months].sort((a, b) => {
      const aCycle = cycleIndexForAnchorMonth(a.monthIndex);
      const bCycle = cycleIndexForAnchorMonth(b.monthIndex);
      return aCycle - bCycle;
    });
  }, [data?.months, payFrequency]);

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
          <Pressable onPress={() => { void load(); }} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const activePeriodAnchorMonth = displayedActiveAnchor?.month ?? activePeriodAnchor.month;
  const activePeriodAnchorYear = displayedActiveAnchor?.year ?? activePeriodAnchor.year;
  return (
  		<SafeAreaView style={[s.safe, { paddingTop: contentTopPadding }]} edges={[]}>
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
            payAnchorDate,
          });
          const periodEndAt = new Date(period.end.getTime());
          periodEndAt.setHours(23, 59, 59, 999);
          const isLocked = periodEndAt.getTime() < now.getTime();
          const isBeforeFirstSelectablePeriod = year < minYear || (year === minYear && item.monthIndex < minMonth);
          const periodLabel = formatPayPeriodLabel(period.start, period.end, locale);
          const canOpenPeriod = hasBudgetPlanId && !isBeforeFirstSelectablePeriod;
          return (
            <IncomeMonthCard
              item={item}
              currency={currency}
              fmt={fmt}
              active={isActive}
              locked={isLocked || isBeforeFirstSelectablePeriod}
              periodLabel={periodLabel}
              onPress={canOpenPeriod ? () => {
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
              } : undefined}
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>No income data for {year}</Text>
            <Text style={s.emptyHint}>Use Add in the tab bar to create your first income.</Text>
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
