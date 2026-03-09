import { useFocusEffect, useNavigation, useRoute, useScrollToTop, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import type { CreditCard, DebtSummaryItem } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { setCachedDebtListData } from "@/lib/debtDetailCache";
import { useTopHeaderOffset } from "@/hooks";
import { useSwipeDownToClose } from "@/hooks";
import type { DebtStackParamList } from "@/navigation/types";
import { useCreateDebtMutation, useGetCreditCardsQuery, useGetDebtSummaryQuery } from "@/store/api";
import { buildDebtProjectionSummary, parseInstallmentMonthlyPayment } from "@/components/DebtScreen/utils";

type Nav = NativeStackNavigationProp<DebtStackParamList, "DebtList">;
type Route = RouteProp<DebtStackParamList, "DebtList">;

export function useDebtScreenController() {
  const listRef = useRef<FlatList<DebtSummaryItem>>(null);
  useScrollToTop(listRef);

  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const topHeaderOffset = useTopHeaderOffset();
  const insets = useSafeAreaInsets();
  const {
    settings,
    isLoading: bootstrapLoading,
    error: bootstrapError,
    refresh: refreshBootstrap,
    ensureLoaded,
  } = useBootstrapData();
  const debtSummaryQuery = useGetDebtSummaryQuery(undefined, { refetchOnMountOrArgChange: true });
  const creditCardsQuery = useGetCreditCardsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [createDebtMutation] = useCreateDebtMutation();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [addMonthlyPayment, setAddMonthlyPayment] = useState("");
  const [addCreditLimit, setAddCreditLimit] = useState("");
  const [addInterestRate, setAddInterestRate] = useState("");
  const [addInstallmentMonths, setAddInstallmentMonths] = useState("");
  const [addInstallmentPreset, setAddInstallmentPreset] = useState<number | "custom" | null>(null);
  const [addType, setAddType] = useState("loan");
  const [addDueDate, setAddDueDate] = useState("");
  const [showAddDueDatePicker, setShowAddDueDatePicker] = useState(false);
  const [addDueDateDraft, setAddDueDateDraft] = useState<Date>(new Date());
  const [addPaymentSource, setAddPaymentSource] = useState<"income" | "extra_funds" | "credit_card">("income");
  const [addPaymentCardDebtId, setAddPaymentCardDebtId] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"active" | "paid_off">("active");
  const [chartWidth, setChartWidth] = useState(320);
  const [selectedProjectionMonth, setSelectedProjectionMonth] = useState<number | null>(null);
  const [optimisticDeletedDebtIds, setOptimisticDeletedDebtIds] = useState<string[]>([]);
  const skipNextTabFocusReloadRef = useRef(false);

  const closeAddDebtSheet = useCallback(() => {
    if (saving) return;
    setShowAddDueDatePicker(false);
    setShowAddForm(false);
  }, [saving]);

  const { dragY: addDebtDragY, panHandlers: addDebtPanHandlers, resetDrag: resetAddDebtDrag } = useSwipeDownToClose({
    onClose: closeAddDebtSheet,
    disabled: saving,
  });

  useEffect(() => {
    if (showAddForm) resetAddDebtDrag();
  }, [resetAddDebtDrag, showAddForm]);

  useEffect(() => {
    if (!showAddDueDatePicker) return;
    setAddDueDateDraft(addDueDate ? new Date(`${addDueDate}T00:00:00`) : new Date());
  }, [addDueDate, showAddDueDatePicker]);

  useEffect(() => {
    const nextMonthly = parseInstallmentMonthlyPayment(addBalance, addInstallmentMonths);
    if (nextMonthly == null) return;
    if (addMonthlyPayment !== nextMonthly) {
      setAddMonthlyPayment(nextMonthly);
    }
  }, [addBalance, addInstallmentMonths, addMonthlyPayment]);

  const summary = debtSummaryQuery.data ?? null;
  const cards = Array.isArray(creditCardsQuery.data) ? creditCardsQuery.data : [];
  const loadingDebts = Boolean((debtSummaryQuery.isLoading || creditCardsQuery.isLoading) && !summary);
  const error = (() => {
    const nextError = debtSummaryQuery.error ?? creditCardsQuery.error;
    if (!nextError) return null;
    return nextError instanceof Error ? nextError.message : "Failed to load debts";
  })();
  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      const [{ settings: bootSettings }] = await Promise.all([
        options?.force ? refreshBootstrap({ force: true }) : ensureLoaded(),
        debtSummaryQuery.refetch(),
        creditCardsQuery.refetch(),
      ]);

      if (!bootSettings) {
        throw bootstrapError ?? new Error("Failed to load settings");
      }
    } finally {
      setRefreshing(false);
    }
  }, [bootstrapError, creditCardsQuery, debtSummaryQuery, ensureLoaded, refreshBootstrap]);

  useEffect(() => {
    if (!summary) return;
    setCachedDebtListData(summary, cards);
  }, [cards, summary]);

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
      void load();
    }, [load]),
  );

  const loading = bootstrapLoading || loadingDebts;

  useEffect(() => {
    const optimisticDeletedDebtId = route.params?.optimisticDeletedDebtId;
    if (typeof optimisticDeletedDebtId === "string" && optimisticDeletedDebtId.trim()) {
      setOptimisticDeletedDebtIds((previous) =>
        previous.includes(optimisticDeletedDebtId) ? previous : [...previous, optimisticDeletedDebtId],
      );
      navigation.setParams({ optimisticDeletedDebtId: undefined });
    }
  }, [navigation, route.params?.optimisticDeletedDebtId]);

  useEffect(() => {
    const restoreDebtId = route.params?.restoreDebtId;
    if (typeof restoreDebtId === "string" && restoreDebtId.trim()) {
      setOptimisticDeletedDebtIds((previous) => previous.filter((id) => id !== restoreDebtId));
      navigation.setParams({ restoreDebtId: undefined });
    }
  }, [navigation, route.params?.restoreDebtId]);

  const debtsExcludingOptimisticDeleted = (summary?.debts ?? []).filter(
    (debt) => !optimisticDeletedDebtIds.includes(debt.id),
  );
  const activeDebts = debtsExcludingOptimisticDeleted.filter((debt) => debt.isActive && !debt.paid);
  const paidDebts = debtsExcludingOptimisticDeleted
    .filter((debt) => debt.paid || debt.currentBalance <= 0)
    .sort((a, b) => {
      const aTime = a.lastPaidAt ? new Date(a.lastPaidAt).getTime() : 0;
      const bTime = b.lastPaidAt ? new Date(b.lastPaidAt).getTime() : 0;
      return bTime - aTime;
    });
  const hasPaidOffDebts = paidDebts.length > 0;

  useEffect(() => {
    if (filter === "paid_off" && !hasPaidOffDebts) {
      setFilter("active");
    }
  }, [filter, hasPaidOffDebts]);

  const visibleDebts = filter === "paid_off" ? paidDebts : activeDebts;
  const isCardType = addType === "credit_card" || addType === "store_card";
  const isLoanStyleType = addType === "loan" || addType === "mortgage";
  const selectablePaymentCards = cards.filter((card: CreditCard) => card.id !== "" && card.id !== undefined);
  const projectionSummary = useMemo(
    () => buildDebtProjectionSummary({ activeDebts, summary, selectedProjectionMonth }),
    [activeDebts, selectedProjectionMonth, summary],
  );

  const handleAdd = useCallback(async () => {
    const name = addName.trim();
    const balance = Number.parseFloat(addBalance);
    const monthlyPayment = addMonthlyPayment.trim() ? Number.parseFloat(addMonthlyPayment) : 0;
    const creditLimit = addCreditLimit.trim() ? Number.parseFloat(addCreditLimit) : null;
    const interestRate = addInterestRate.trim() ? Number.parseFloat(addInterestRate) : null;
    const installmentMonths = addInstallmentMonths.trim() ? Number.parseInt(addInstallmentMonths, 10) : null;

    if (!name) {
      Alert.alert("Missing name", "Enter a debt name.");
      return;
    }
    if (!addDueDate.trim()) {
      Alert.alert("Missing due date", "Select a due date before adding this debt.");
      return;
    }

    const dueDate = new Date(`${addDueDate}T00:00:00`);
    if (!Number.isFinite(dueDate.getTime())) {
      Alert.alert("Invalid due date", "Select a valid due date.");
      return;
    }
    if (Number.isNaN(balance) || (isCardType ? balance < 0 : balance <= 0)) {
      Alert.alert("Invalid amount", isCardType ? "Enter a valid balance (0 or more)." : "Enter a valid balance.");
      return;
    }
    if (Number.isNaN(monthlyPayment) || monthlyPayment < 0) {
      Alert.alert("Invalid monthly payment", "Enter a valid monthly payment (0 or more).");
      return;
    }
    if (addPaymentSource === "credit_card" && !addPaymentCardDebtId.trim()) {
      Alert.alert("Source card required", "Select the card you’ll use to pay this debt.");
      return;
    }
    if (creditLimit != null && (!Number.isFinite(creditLimit) || creditLimit <= 0)) {
      Alert.alert("Invalid credit limit", "Enter a valid credit limit.");
      return;
    }
    if (interestRate != null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      Alert.alert("Invalid interest", "Enter a valid interest rate (APR).");
      return;
    }
    if (installmentMonths != null && (!Number.isFinite(installmentMonths) || installmentMonths <= 0)) {
      Alert.alert("Invalid term", "Enter how many months to pay over.");
      return;
    }

    try {
      setSaving(true);
      await createDebtMutation({
        amount: monthlyPayment,
        budgetPlanId: settings?.id ?? "",
        creditLimit: isCardType ? creditLimit : null,
        currentBalance: balance,
        defaultPaymentCardDebtId: addPaymentSource === "credit_card" ? addPaymentCardDebtId.trim() : null,
        defaultPaymentSource: addPaymentSource,
        dueDate: addDueDate,
        dueDay: dueDate.getUTCDate(),
        initialBalance: balance,
        installmentMonths,
        interestRate,
        name,
        type: addType,
      }).unwrap();

      setAddName("");
      setAddBalance("");
      setAddMonthlyPayment("");
      setAddCreditLimit("");
      setAddInterestRate("");
      setAddInstallmentMonths("");
      setAddInstallmentPreset(null);
      setAddDueDate("");
      setShowAddDueDatePicker(false);
      setAddPaymentSource("income");
      setAddPaymentCardDebtId("");
      setShowAddForm(false);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add debt");
    } finally {
      setSaving(false);
    }
  }, [addBalance, addCreditLimit, addDueDate, addInstallmentMonths, addInterestRate, addMonthlyPayment, addName, addPaymentCardDebtId, addPaymentSource, addType, createDebtMutation, isCardType, settings?.id]);

  return {
    activeDebts,
    addBalance,
    addCreditLimit,
    addDebtDragY,
    addDebtPanHandlers,
    addDueDate,
    addDueDateDraft,
    addInstallmentMonths,
    addInstallmentPreset,
    addInterestRate,
    addMonthlyPayment,
    addName,
    addPaymentCardDebtId,
    addPaymentSource,
    addType,
    cards,
    chartWidth,
    closeAddDebtSheet,
    currency,
    error,
    filter,
    handleAdd,
    hasPaidOffDebts,
    insets,
    isCardType,
    isLoanStyleType,
    listRef,
    loading,
    onChangeDueDate: (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type === "dismissed") {
        setShowAddDueDatePicker(false);
        return;
      }
      const next = selectedDate ?? (event.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
      if (next) {
        setAddDueDateDraft(next);
        if (Platform.OS === "android") {
          setAddDueDate(next.toISOString().slice(0, 10));
          setShowAddDueDatePicker(false);
        }
      }
    },
    onChangePaymentSource: (next: string) => {
      const source = next as "income" | "extra_funds" | "credit_card";
      setAddPaymentSource(source);
      if (source !== "credit_card") setAddPaymentCardDebtId("");
    },
    onClearInstallments: () => {
      setAddInstallmentPreset(null);
      setAddInstallmentMonths("");
    },
    onConfirmDueDate: () => {
      setAddDueDate(addDueDateDraft.toISOString().slice(0, 10));
      setShowAddDueDatePicker(false);
    },
    onOpenAddForm: () => setShowAddForm(true),
    onOpenAnalytics: () => navigation.navigate("DebtAnalytics", {
      currency,
      debts: activeDebts,
      totalMonthly: projectionSummary.monthly,
    }),
    onPressDebt: (debt: DebtSummaryItem) => navigation.navigate("DebtDetail", { debtId: debt.id, debtName: debt.displayTitle ?? debt.name }),
    onRefresh: () => {
      setRefreshing(true);
      void load({ force: true });
    },
    onRetry: () => {
      setRefreshing(true);
      void load({ force: true });
    },
    onSelectCustomInstallmentPreset: () => {
      if (addInstallmentPreset === "custom") {
        setAddInstallmentPreset(null);
        setAddInstallmentMonths("");
        return;
      }
      setAddInstallmentPreset("custom");
      setAddInstallmentMonths("");
    },
    onSelectInstallmentPreset: (months: number) => {
      if (addInstallmentPreset === months) {
        setAddInstallmentPreset(null);
        setAddInstallmentMonths("");
        return;
      }
      setAddInstallmentPreset(months);
      setAddInstallmentMonths(String(months));
    },
    paidDebts,
    projectionSummary,
    refreshing,
    selectablePaymentCards,
    selectedProjectionMonth,
    setAddBalance,
    setAddCreditLimit,
    setAddDueDate,
    setAddDueDateDraft,
    setAddInstallmentMonths,
    setAddInterestRate,
    setAddMonthlyPayment,
    setAddName,
    setAddPaymentCardDebtId,
    setAddType,
    setChartWidth,
    setFilter,
    setSelectedProjectionMonth,
    setShowAddDueDatePicker,
    settings,
    showAddDueDatePicker,
    showAddForm,
    summary,
    topHeaderOffset,
    visibleDebts,
    saving,
  };
}

export default useDebtScreenController;