import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Animated, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  BudgetPlanListItem,
  BudgetPlansResponse,
  Debt,
  Settings,
  UserProfile,
} from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { useSavingsPotStore } from "@/lib/hooks/useSavingsPotStore";
import { useSettingsDebtBuckets } from "@/lib/hooks/useSettingsDebtBuckets";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import {
  deleteNotificationInboxItem,
  markNotificationInboxItemRead,
  subscribeNotificationInbox,
  type NotificationInboxItem,
} from "@/lib/notificationInbox";
import type { MainTabScreenProps } from "@/navigation/types";
import {
  asMoneyInput,
  asMoneyNumber,
  asMoneyText,
  normalizeDateToYmd,
  parseLocaleCountry,
  mapSavingsFieldToBalanceField,
  mapSavingsFieldToGoalTargetKey,
  mapSavingsFieldToSacrificeType,
  getSavingsFieldTitle,
} from "@/lib/helpers/settings";
import type {
  BillFrequency,
  BudgetField,
  CreateSacrificeItemResponse,
  DebtKind,
  MoneyViewMode,
  NotificationPrefs,
  NotificationPrefsResponse,
  PayFrequency,
  PlanKind,
  SacrificeGoalsResponse,
  SavingsField,
  SavingsPot,
  SavingsSheetMode,
  SettingsTab,
} from "@/types/settings";

const NOTIFICATION_PREFS_KEY = "budget_app.notification_prefs";
const MONEY_TOGGLE_SEGMENT_WIDTH = (Math.max(220, Dimensions.get("window").width - 32) - 8) / 2;
const MONEY_TOP_OFFSET_REDUCTION = 8;

type SettingsScreenControllerParams = Pick<MainTabScreenProps<"Settings">, "navigation" | "route">;

export function useSettingsScreenController({ navigation, route }: SettingsScreenControllerParams) {
  const topHeaderOffset = useTopHeaderOffset();
  const insets = useSafeAreaInsets();
  const { username: authUsername, signOut } = useAuth();
  const { readSavingsPotsForPlan, writeSavingsPotsForPlan } = useSavingsPotStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<BudgetPlanListItem[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPlan, setNoPlan] = useState(false);

  const [activeTab, setActiveTab] = useState<SettingsTab>("details");
  const [moneyViewMode, setMoneyViewMode] = useState<MoneyViewMode>("personal");
  const moneyToggleAnim = React.useRef(new Animated.Value(0)).current;
  const [moreOpen, setMoreOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationPrefs>({ dueReminders: true, paymentAlerts: true, dailyTips: true });
  const [notificationInbox, setNotificationInbox] = useState<NotificationInboxItem[]>([]);

  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [budgetFieldSheet, setBudgetFieldSheet] = useState<BudgetField | null>(null);
  const [savingsSheetField, setSavingsSheetField] = useState<SavingsField | null>(null);
  const [savingsSheetMode, setSavingsSheetMode] = useState<SavingsSheetMode>("add");
  const [savingsEditingPotId, setSavingsEditingPotId] = useState<string | null>(null);
  const [localeSheetOpen, setLocaleSheetOpen] = useState(false);
  const [addDebtSheetOpen, setAddDebtSheetOpen] = useState(false);
  const [createPlanSheetOpen, setCreatePlanSheetOpen] = useState(false);

  const [saveBusy, setSaveBusy] = useState(false);
  const [switchingPlanId, setSwitchingPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [planDeleteTarget, setPlanDeleteTarget] = useState<BudgetPlanListItem | null>(null);

  const [emailDraft, setEmailDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");

  const [payDateDraft, setPayDateDraft] = useState("");
  const [horizonDraft, setHorizonDraft] = useState("");
  const [payFrequencyDraft, setPayFrequencyDraft] = useState<PayFrequency>("monthly");
  const [billFrequencyDraft, setBillFrequencyDraft] = useState<BillFrequency>("monthly");
  const [strategyDraft, setStrategyDraft] = useState("payYourselfFirst");
  const [savingsValueDraft, setSavingsValueDraft] = useState("");
  const [savingsPotNameDraft, setSavingsPotNameDraft] = useState("");
  const [savingsPots, setSavingsPots] = useState<SavingsPot[]>([]);
  const [sacrificeLinkedTargetKeys, setSacrificeLinkedTargetKeys] = useState<string[]>([]);
  const [sacrificeGoalsCount, setSacrificeGoalsCount] = useState(0);

  const [editDebtTarget, setEditDebtTarget] = useState<Debt | null>(null);

  const closeDetailsSheet = useCallback(() => setDetailsSheetOpen(false), []);
  const closeBudgetFieldSheet = useCallback(() => setBudgetFieldSheet(null), []);
  const closeSavingsSheet = useCallback(() => {
    setSavingsSheetField(null);
    setSavingsSheetMode("add");
    setSavingsEditingPotId(null);
    setSavingsValueDraft("");
    setSavingsPotNameDraft("");
  }, []);
  const closeEditDebtSheet = useCallback(() => setEditDebtTarget(null), []);
  const closeLocaleSheet = useCallback(() => setLocaleSheetOpen(false), []);
  const closeAddDebtSheet = useCallback(() => setAddDebtSheetOpen(false), []);
  const closeCreatePlanSheet = useCallback(() => setCreatePlanSheetOpen(false), []);

  const { dragY: detailsSheetDragY, panHandlers: detailsSheetPanHandlers, resetDrag: resetDetailsSheetDrag } = useSwipeDownToClose({
    onClose: closeDetailsSheet,
    disabled: saveBusy,
  });

  const { dragY: budgetFieldSheetDragY, panHandlers: budgetFieldSheetPanHandlers, resetDrag: resetBudgetFieldSheetDrag } = useSwipeDownToClose({
    onClose: closeBudgetFieldSheet,
    disabled: saveBusy,
  });

  const { dragY: savingsSheetDragY, panHandlers: savingsSheetPanHandlers, resetDrag: resetSavingsSheetDrag } = useSwipeDownToClose({
    onClose: closeSavingsSheet,
    disabled: saveBusy,
  });

  const { dragY: editDebtSheetDragY, panHandlers: editDebtSheetPanHandlers, resetDrag: resetEditDebtSheetDrag } = useSwipeDownToClose({
    onClose: closeEditDebtSheet,
    disabled: saveBusy,
  });

  const { dragY: localeSheetDragY, panHandlers: localeSheetPanHandlers, resetDrag: resetLocaleSheetDrag } = useSwipeDownToClose({
    onClose: closeLocaleSheet,
    disabled: saveBusy,
  });

  const { dragY: addDebtSheetDragY, panHandlers: addDebtSheetPanHandlers, resetDrag: resetAddDebtSheetDrag } = useSwipeDownToClose({
    onClose: closeAddDebtSheet,
    disabled: saveBusy,
  });

  const { dragY: createPlanSheetDragY, panHandlers: createPlanSheetPanHandlers, resetDrag: resetCreatePlanSheetDrag } = useSwipeDownToClose({
    onClose: closeCreatePlanSheet,
    disabled: saveBusy,
  });

  useEffect(() => { if (detailsSheetOpen) resetDetailsSheetDrag(); }, [detailsSheetOpen, resetDetailsSheetDrag]);
  useEffect(() => { if (budgetFieldSheet !== null) resetBudgetFieldSheetDrag(); }, [budgetFieldSheet, resetBudgetFieldSheetDrag]);
  useEffect(() => { if (savingsSheetField !== null) resetSavingsSheetDrag(); }, [resetSavingsSheetDrag, savingsSheetField]);
  useEffect(() => { if (editDebtTarget) resetEditDebtSheetDrag(); }, [editDebtTarget, resetEditDebtSheetDrag]);
  useEffect(() => { if (localeSheetOpen) resetLocaleSheetDrag(); }, [localeSheetOpen, resetLocaleSheetDrag]);
  useEffect(() => { if (addDebtSheetOpen) resetAddDebtSheetDrag(); }, [addDebtSheetOpen, resetAddDebtSheetDrag]);
  useEffect(() => { if (createPlanSheetOpen) resetCreatePlanSheetDrag(); }, [createPlanSheetOpen, resetCreatePlanSheetDrag]);

  const [editDebtName, setEditDebtName] = useState("");
  const [editDebtType, setEditDebtType] = useState<DebtKind>("credit_card");
  const [editDebtInitialBalance, setEditDebtInitialBalance] = useState("");
  const [editDebtBalance, setEditDebtBalance] = useState("");
  const [editDebtLimit, setEditDebtLimit] = useState("");
  const [editDebtMonthlyPayment, setEditDebtMonthlyPayment] = useState("");
  const [editDebtInterestRate, setEditDebtInterestRate] = useState("");

  const [addDebtName, setAddDebtName] = useState("");
  const [addDebtType, setAddDebtType] = useState<DebtKind>("credit_card");
  const [addDebtInitialBalance, setAddDebtInitialBalance] = useState("");
  const [addDebtBalance, setAddDebtBalance] = useState("");
  const [addDebtLimit, setAddDebtLimit] = useState("");
  const [addDebtMonthlyPayment, setAddDebtMonthlyPayment] = useState("");
  const [addDebtInterestRate, setAddDebtInterestRate] = useState("");

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanType, setNewPlanType] = useState<PlanKind>("holiday");
  const [newPlanEventDate, setNewPlanEventDate] = useState("");

  const [showPlanEventDatePicker, setShowPlanEventDatePicker] = useState(false);
  const planEventBeforeRef = React.useRef<string>("");
  const [iosPlanEventDraft, setIosPlanEventDraft] = useState<Date>(new Date());

  const openPlanEventDatePicker = useCallback(() => {
    planEventBeforeRef.current = newPlanEventDate;
    setIosPlanEventDraft(newPlanEventDate ? new Date(`${newPlanEventDate}T00:00:00`) : new Date());
    setShowPlanEventDatePicker(true);
  }, [newPlanEventDate]);

  const cancelPlanEventDatePicker = useCallback(() => {
    setShowPlanEventDatePicker(false);
    if (planEventBeforeRef.current !== newPlanEventDate) {
      setNewPlanEventDate(planEventBeforeRef.current);
    }
  }, [newPlanEventDate]);

  const closePlanEventDatePicker = useCallback(() => {
    setNewPlanEventDate(iosPlanEventDraft.toISOString().slice(0, 10));
    setShowPlanEventDatePicker(false);
  }, [iosPlanEventDraft]);

  const detectedCountry = useMemo(() => parseLocaleCountry(), []);
  const currentPlanId = settings?.id ?? null;
  const currentPlan = useMemo(() => plans.find((p) => p.id === currentPlanId) ?? null, [plans, currentPlanId]);
  const { groupedDebts } = useSettingsDebtBuckets(debts);
  const cur = currencySymbol(settings?.currency);
  const savingsBase = asMoneyNumber(settings?.savingsBalance);
  const emergencyBase = asMoneyNumber(settings?.emergencyBalance);
  const investmentBase = asMoneyNumber(settings?.investmentBalance);
  const savingsMonthly = asMoneyNumber(settings?.monthlySavingsContribution);
  const emergencyMonthly = asMoneyNumber(settings?.monthlyEmergencyContribution);
  const investmentMonthly = asMoneyNumber(settings?.monthlyInvestmentContribution);
  const savingsTotal = savingsBase + savingsMonthly;
  const emergencyTotal = emergencyBase + emergencyMonthly;
  const investmentTotal = investmentBase + investmentMonthly;
  const savingsSheetCurrentAmount = useMemo(() => {
    if (!savingsSheetField) return 0;
    if (savingsEditingPotId) {
      const pot = savingsPots.find((entry) => entry.id === savingsEditingPotId);
      return asMoneyNumber(pot?.amount);
    }
    const balanceField = mapSavingsFieldToBalanceField(savingsSheetField);
    return asMoneyNumber(settings?.[balanceField]);
  }, [savingsEditingPotId, savingsPots, savingsSheetField, settings]);

  const savingsSheetIcon = savingsSheetField === "emergency"
    ? "shield-checkmark-outline"
    : savingsSheetField === "investment"
      ? "trending-up-outline"
      : "wallet-outline";

  const savingsSheetGoalImpactNote = useMemo(() => {
    if (savingsSheetMode !== "edit" || !savingsSheetField) return null;
    const linked = new Set(sacrificeLinkedTargetKeys);
    let isLinkedToGoal = false;

    if (savingsEditingPotId) {
      const pot = savingsPots.find((entry) => entry.id === savingsEditingPotId);
      isLinkedToGoal = Boolean(pot?.allocationId && linked.has(`custom:${pot.allocationId}`));
    } else {
      isLinkedToGoal = linked.has(mapSavingsFieldToGoalTargetKey(savingsSheetField));
    }

    if (isLinkedToGoal) {
      return "Changing this amount will increase or reduce linked goal progress.";
    }
    if (sacrificeGoalsCount > 0) {
      return "You have goals. Link this item in Income sacrifice so changes here can update goal amounts.";
    }
    return null;
  }, [sacrificeGoalsCount, sacrificeLinkedTargetKeys, savingsEditingPotId, savingsPots, savingsSheetField, savingsSheetMode]);
  const savingsCards = useMemo(
    () => [
      {
        key: "savings" as const,
        title: "Savings",
        icon: "wallet-outline" as const,
        total: savingsTotal,
        base: savingsBase,
        monthly: savingsMonthly,
      },
      {
        key: "emergency" as const,
        title: "Emergency funds",
        icon: "shield-checkmark-outline" as const,
        total: emergencyTotal,
        base: emergencyBase,
        monthly: emergencyMonthly,
      },
      {
        key: "investment" as const,
        title: "Investments",
        icon: "trending-up-outline" as const,
        total: investmentTotal,
        base: investmentBase,
        monthly: investmentMonthly,
      },
    ],
    [emergencyBase, emergencyMonthly, emergencyTotal, investmentBase, investmentMonthly, investmentTotal, savingsBase, savingsMonthly, savingsTotal]
  );
  const savingsPotsByField = useMemo(
    () => ({
      savings: savingsPots.filter((pot) => pot.field === "savings"),
      emergency: savingsPots.filter((pot) => pot.field === "emergency"),
      investment: savingsPots.filter((pot) => pot.field === "investment"),
    }),
    [savingsPots]
  );
  const allDebtItems = useMemo(() => groupedDebts.flatMap((group) => group.items), [groupedDebts]);
  const isStoreCardDebt = useCallback((debt: Debt) => {
    const debtType = String(debt.type ?? "").toLowerCase();
    const debtName = String(debt.name ?? "").toLowerCase();
    if (debtType === "store_card") return true;
    return /\bstore\b/.test(debtName);
  }, []);
  const creditCardDebts = useMemo(
    () => allDebtItems.filter((debt) => debt.type === "credit_card" && !isStoreCardDebt(debt)),
    [allDebtItems, isStoreCardDebt]
  );
  const storeCardDebts = useMemo(
    () => allDebtItems.filter((debt) => isStoreCardDebt(debt)),
    [allDebtItems, isStoreCardDebt]
  );
  const creditCardGroups = useMemo(
    () => (creditCardDebts.length ? [{ key: "credit_card" as const, label: "Credit Cards", icon: "card-outline" as const, items: creditCardDebts }] : []),
    [creditCardDebts]
  );
  const storeCardGroups = useMemo(
    () => (storeCardDebts.length ? [{ key: "other" as const, label: "Store Cards", icon: "card-outline" as const, items: storeCardDebts }] : []),
    [storeCardDebts]
  );

  const isMoreTabActive = useMemo(
    () => ["locale", "notifications", "danger"].some((tab) => tab === activeTab),
    [activeTab]
  );

  const loadNotifications = useCallback(async () => {
    const readFromSecureStore = async () => {
      try {
        const raw = await SecureStore.getItemAsync(NOTIFICATION_PREFS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as NotificationPrefs;
        if (
          typeof parsed?.dueReminders === "boolean" &&
          typeof parsed?.paymentAlerts === "boolean" &&
          typeof parsed?.dailyTips === "boolean"
        ) {
          setNotifications(parsed);
        }
      } catch {
        // ignore
      }
    };

    try {
      const remote = await apiFetch<NotificationPrefsResponse>("/api/bff/notifications/preferences", {
        cacheTtlMs: 0,
      });
      if (
        typeof remote?.dueReminders === "boolean" &&
        typeof remote?.paymentAlerts === "boolean" &&
        typeof remote?.dailyTips === "boolean"
      ) {
        const next = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
          dailyTips: remote.dailyTips,
        };
        setNotifications(next);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
        return;
      }
    } catch {
      await readFromSecureStore();
    }
  }, []);

  const formatNotificationReceivedAt = useCallback((value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const saveNotifications = useCallback(async (next: NotificationPrefs) => {
    setNotifications(next);
    await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
    try {
      const remote = await apiFetch<NotificationPrefsResponse>("/api/bff/notifications/preferences", {
        method: "PUT",
        body: {
          dueReminders: next.dueReminders,
          paymentAlerts: next.paymentAlerts,
          dailyTips: next.dailyTips,
        },
      });

      if (
        typeof remote?.dueReminders === "boolean" &&
        typeof remote?.paymentAlerts === "boolean" &&
        typeof remote?.dailyTips === "boolean"
      ) {
        const synced = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
          dailyTips: remote.dailyTips,
        };
        setNotifications(synced);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(synced));
      }
    } catch (err: unknown) {
      Alert.alert("Notification settings", err instanceof Error ? err.message : "Failed to sync settings.");
    }
  }, []);

  const hydrateDrafts = useCallback((nextSettings: Settings | null, nextProfile: UserProfile | null) => {
    setEmailDraft(nextProfile?.email ?? "");
    setCountryDraft((nextSettings?.country ?? "").toUpperCase());
    setPayDateDraft(nextSettings?.payDate ? String(nextSettings.payDate) : "");
    setHorizonDraft(currentPlan?.budgetHorizonYears ? String(currentPlan.budgetHorizonYears) : "10");
    setPayFrequencyDraft(nextSettings?.payFrequency === "weekly" || nextSettings?.payFrequency === "every_2_weeks" ? nextSettings.payFrequency : "monthly");
    setBillFrequencyDraft(nextSettings?.billFrequency === "every_2_weeks" ? "every_2_weeks" : "monthly");
    setStrategyDraft(nextSettings?.budgetStrategy ?? "payYourselfFirst");
  }, [currentPlan?.budgetHorizonYears]);

  const load = useCallback(async () => {
    try {
      setError(null);

      const [plansResp, me] = await Promise.all([
        apiFetch<BudgetPlansResponse>("/api/bff/budget-plans"),
        apiFetch<UserProfile>("/api/bff/me"),
      ]);

      const nextPlans = Array.isArray(plansResp?.plans) ? plansResp.plans : [];
      setPlans(nextPlans);
      setProfile(me);

      if (nextPlans.length === 0) {
        setNoPlan(true);
        setSettings(null);
        setDebts([]);
        hydrateDrafts(null, me);
        return;
      }

      const preferredPlanId =
        currentPlanId && nextPlans.some((p) => p.id === currentPlanId)
          ? currentPlanId
          : nextPlans.find((p) => p.kind === "personal")?.id ?? nextPlans[0].id;

      const [nextSettings, nextDebts] = await Promise.all([
        apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(preferredPlanId)}`),
        apiFetch<Debt[]>(`/api/bff/debts?budgetPlanId=${encodeURIComponent(preferredPlanId)}`),
      ]);

      setSettings(nextSettings);
      setDebts(Array.isArray(nextDebts) ? nextDebts : []);
      setNoPlan(false);
      hydrateDrafts(nextSettings, me);
    } catch (err: unknown) {
      const isNoPlanError =
        err instanceof ApiError &&
        err.status === 404 &&
        /budget plan not found/i.test(err.message);
      if (isNoPlanError) {
        setNoPlan(true);
        setSettings(null);
        setDebts([]);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPlanId, hydrateDrafts]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      void load();
    });
    return unsub;
  }, [navigation, load]);

  const requestedInitialTab = (route as unknown as { params?: { initialTab?: unknown } } | undefined)?.params?.initialTab;

  useEffect(() => {
    if (requestedInitialTab !== "notifications" && requestedInitialTab !== "budget") return;

    setActiveTab((prev) => (prev === requestedInitialTab ? prev : requestedInitialTab));

    const currentRoute = navigation.getState()?.routes?.find((entry) => entry.key === route.key);
    const params = (currentRoute?.params as { initialTab?: unknown } | undefined) ?? undefined;
    if (!params || params.initialTab !== requestedInitialTab) return;

    navigation.setParams({ initialTab: undefined });
  }, [navigation, requestedInitialTab, route.key]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationInbox((snapshot) => {
      setNotificationInbox(snapshot.items);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTab !== "notifications") return;

    const clearWhenViewed = () => {
      void (async () => {
        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch {
          // ignore
        }
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch {
          // ignore
        }
      })();
    };

    clearWhenViewed();
    const unsubscribe = navigation.addListener("focus", clearWhenViewed);
    return unsubscribe;
  }, [activeTab, navigation]);

  useEffect(() => {
    Animated.spring(moneyToggleAnim, {
      toValue: moneyViewMode === "cards" ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [moneyToggleAnim, moneyViewMode]);

  useEffect(() => {
    const planId = settings?.id;
    if (!planId) {
      setSavingsPots([]);
      return;
    }
    void (async () => {
      try {
        const storedPots = await readSavingsPotsForPlan(planId);
        const missingLinks = storedPots.filter((pot) => !pot.allocationId);
        if (missingLinks.length === 0) {
          setSavingsPots(storedPots);
          return;
        }

        const now = new Date();
        let didUpdate = false;
        const syncedPots = [...storedPots];
        for (let i = 0; i < syncedPots.length; i += 1) {
          const pot = syncedPots[i];
          if (!pot || pot.allocationId) continue;
          try {
            const created = await apiFetch<CreateSacrificeItemResponse>("/api/bff/income-sacrifice/custom", {
              method: "POST",
              body: {
                budgetPlanId: planId,
                type: mapSavingsFieldToSacrificeType(pot.field),
                name: pot.name,
                amount: 0,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
              },
            });
            const allocationId = typeof created?.item?.id === "string" ? created.item.id.trim() : "";
            if (!allocationId) continue;
            syncedPots[i] = {
              ...pot,
              allocationId,
            };
            didUpdate = true;
          } catch {
            // Keep existing local pot even if allocation sync fails.
          }
        }

        if (didUpdate) {
          await writeSavingsPotsForPlan(planId, syncedPots);
        }
        setSavingsPots(syncedPots);
      } catch {
        setSavingsPots([]);
      }
    })();
  }, [readSavingsPotsForPlan, settings?.id, writeSavingsPotsForPlan]);

  useEffect(() => {
    const planId = settings?.id;
    if (!planId) {
      setSacrificeLinkedTargetKeys([]);
      setSacrificeGoalsCount(0);
      return;
    }

    void (async () => {
      try {
        const now = new Date();
        const goals = await apiFetch<SacrificeGoalsResponse>(
          `/api/bff/income-sacrifice/goals?budgetPlanId=${encodeURIComponent(planId)}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`
        );
        const linkedKeys = Array.isArray(goals?.links)
          ? goals.links
            .map((row) => (typeof row?.targetKey === "string" ? row.targetKey.trim() : ""))
            .filter((row): row is string => Boolean(row))
          : [];
        const goalCount = Array.isArray(goals?.goals) ? goals.goals.length : 0;
        setSacrificeLinkedTargetKeys(linkedKeys);
        setSacrificeGoalsCount(goalCount);
      } catch {
        setSacrificeLinkedTargetKeys([]);
        setSacrificeGoalsCount(0);
      }
    })();
  }, [settings?.id]);

  const createPersonalPlan = async () => {
    try {
      setSaveBusy(true);
      await apiFetch("/api/bff/budget-plans", {
        method: "POST",
        body: { kind: "personal", name: "Personal" },
      });
      await load();
    } catch (err: unknown) {
      Alert.alert("Could not create plan", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const switchPlan = async (budgetPlanId: string) => {
    try {
      setSwitchingPlanId(budgetPlanId);
      setError(null);
      const [nextSettings, nextDebts] = await Promise.all([
        apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
        apiFetch<Debt[]>(`/api/bff/debts?budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
      ]);
      setSettings(nextSettings);
      setDebts(Array.isArray(nextDebts) ? nextDebts : []);
      hydrateDrafts(nextSettings, profile);
    } catch (err: unknown) {
      Alert.alert("Could not open plan", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSwitchingPlanId(null);
    }
  };

  const saveDetails = async () => {
    try {
      setSaveBusy(true);
      const next = await apiFetch<UserProfile>("/api/bff/me", {
        method: "PATCH",
        body: { email: emailDraft.trim() || null },
      });
      setProfile(next);
      setDetailsSheetOpen(false);
    } catch (err: unknown) {
      Alert.alert("Could not save details", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const saveBudgetField = async () => {
    if (!settings?.id) return;

    try {
      setSaveBusy(true);

      if (budgetFieldSheet === "payDate") {
        const payDate = Number(payDateDraft);
        if (!Number.isInteger(payDate) || payDate < 1 || payDate > 31) {
          Alert.alert("Invalid pay date", "Pay date must be between 1 and 31.");
          return;
        }
        await Promise.all([
          apiFetch("/api/bff/settings", {
            method: "PATCH",
            body: {
              budgetPlanId: settings.id,
              payDate,
            },
          }),
          apiFetch(`/api/bff/budget-plans/${encodeURIComponent(settings.id)}`, {
            method: "PATCH",
            body: {
              payDate,
            },
          }),
        ]);
      }

      if (budgetFieldSheet === "horizon") {
        const years = Number(horizonDraft);
        if (!Number.isInteger(years) || years < 1 || years > 50) {
          Alert.alert("Invalid horizon", "Budget horizon must be between 1 and 50 years.");
          return;
        }
        await apiFetch(`/api/bff/budget-plans/${encodeURIComponent(settings.id)}`, {
          method: "PATCH",
          body: {
            budgetHorizonYears: years,
          },
        });
      }

      if (budgetFieldSheet === "payFrequency") {
        await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId: settings.id,
            payFrequency: payFrequencyDraft,
          },
        });
      }

      if (budgetFieldSheet === "billFrequency") {
        await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId: settings.id,
            billFrequency: billFrequencyDraft,
          },
        });
      }

      setBudgetFieldSheet(null);
      await load();
    } catch (err: unknown) {
      Alert.alert("Could not save budget settings", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const openSavingsField = (field: SavingsField) => {
    setSavingsSheetMode("add");
    setSavingsEditingPotId(null);
    setSavingsSheetField(field);
    setSavingsValueDraft("");
    setSavingsPotNameDraft("");
  };

  const openSavingsEditor = (field: SavingsField, potId?: string) => {
    setSavingsSheetMode("edit");
    setSavingsSheetField(field);
    if (potId) {
      const pot = savingsPots.find((entry) => entry.id === potId && entry.field === field);
      if (!pot) return;
      setSavingsEditingPotId(pot.id);
      setSavingsPotNameDraft(pot.name);
      setSavingsValueDraft(asMoneyText(pot.amount));
      return;
    }

    setSavingsEditingPotId(null);
    setSavingsPotNameDraft(getSavingsFieldTitle(field));
    const balanceField = mapSavingsFieldToBalanceField(field);
    const currentValue = asMoneyNumber(settings?.[balanceField]);
    setSavingsValueDraft(asMoneyText(currentValue));
  };

  const saveSavingsField = async () => {
    if (!settings?.id || !savingsSheetField) return;

    const value = Number(savingsValueDraft || 0);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Invalid amount", "Enter an amount of 0 or more.");
      return;
    }

    if (savingsSheetMode === "edit") {
      const balanceField = mapSavingsFieldToBalanceField(savingsSheetField);
      const currentBalance = asMoneyNumber(settings?.[balanceField]);

      try {
        setSaveBusy(true);

        if (savingsEditingPotId) {
          const pot = savingsPots.find((entry) => entry.id === savingsEditingPotId);
          if (!pot) {
            Alert.alert("Pot not found", "This pot no longer exists.");
            return;
          }

          const nextBalance = Math.max(0, currentBalance - asMoneyNumber(pot.amount) + value);
          const updated = await apiFetch<Settings>("/api/bff/settings", {
            method: "PATCH",
            body: {
              budgetPlanId: settings.id,
              [balanceField]: nextBalance,
            },
          });

          const nextPots = savingsPots.map((entry) => (
            entry.id === pot.id
              ? { ...entry, amount: value }
              : entry
          ));
          await writeSavingsPotsForPlan(settings.id, nextPots);
          setSavingsPots(nextPots);
          setSettings(updated);
          closeSavingsSheet();
          return;
        }

        const updated = await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId: settings.id,
            [balanceField]: value,
          },
        });
        setSettings(updated);
        closeSavingsSheet();
        return;
      } catch (err: unknown) {
        Alert.alert("Could not save amount", err instanceof Error ? err.message : "Please try again.");
      } finally {
        setSaveBusy(false);
      }
      return;
    }

    const potName = savingsPotNameDraft.trim();
    if (!potName) {
      Alert.alert("Pot name required", "Enter a name for this savings pot.");
      return;
    }
    if (value <= 0) {
      Alert.alert("Invalid amount", "Enter an additional amount greater than 0.");
      return;
    }

    let createdAllocationId: string | null = null;

    try {
      setSaveBusy(true);
      const now = new Date();

      const createdItem = await apiFetch<CreateSacrificeItemResponse>("/api/bff/income-sacrifice/custom", {
        method: "POST",
        body: {
          budgetPlanId: settings.id,
          type: mapSavingsFieldToSacrificeType(savingsSheetField),
          name: potName,
          amount: 0,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      });
      const allocationId = typeof createdItem?.item?.id === "string" ? createdItem.item.id.trim() : "";
      if (!allocationId) {
        throw new Error("Could not register this pot as a monthly allocation item.");
      }
      createdAllocationId = allocationId;

      const payload: Record<string, number | string> = {
        budgetPlanId: settings.id,
      };
      if (savingsSheetField === "savings") payload.additionalSavingsBalance = value;
      if (savingsSheetField === "emergency") payload.additionalEmergencyBalance = value;
      if (savingsSheetField === "investment") payload.additionalInvestmentBalance = value;

      const updated = await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: payload,
      });

      const nextPots: SavingsPot[] = [
        ...savingsPots,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          field: savingsSheetField,
          name: potName,
          amount: value,
          allocationId: createdAllocationId,
        },
      ];

      await writeSavingsPotsForPlan(settings.id, nextPots);
      setSavingsPots(nextPots);
      setSettings(updated);
      closeSavingsSheet();
    } catch (err: unknown) {
      if (createdAllocationId && settings?.id) {
        try {
          await apiFetch(`/api/bff/income-sacrifice/custom/${encodeURIComponent(createdAllocationId)}`, {
            method: "DELETE",
            body: {},
          });
        } catch {
          // Best-effort rollback only.
        }
      }
      Alert.alert("Could not add amount", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const deleteSavingsItem = async () => {
    if (!settings?.id || !savingsSheetField || savingsSheetMode !== "edit") return;

    try {
      setSaveBusy(true);
      const balanceField = mapSavingsFieldToBalanceField(savingsSheetField);
      const currentBalance = asMoneyNumber(settings?.[balanceField]);

      if (savingsEditingPotId) {
        const pot = savingsPots.find((entry) => entry.id === savingsEditingPotId);
        if (!pot) {
          Alert.alert("Pot not found", "This pot no longer exists.");
          return;
        }

        const nextBalance = Math.max(0, currentBalance - asMoneyNumber(pot.amount));
        const updated = await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId: settings.id,
            [balanceField]: nextBalance,
          },
        });

        if (pot.allocationId) {
          try {
            await apiFetch(`/api/bff/income-sacrifice/custom/${encodeURIComponent(pot.allocationId)}`, {
              method: "DELETE",
              body: {},
            });
          } catch {
            // Best-effort cleanup.
          }
        }

        const nextPots = savingsPots.filter((entry) => entry.id !== pot.id);
        await writeSavingsPotsForPlan(settings.id, nextPots);
        setSavingsPots(nextPots);
        setSettings(updated);
        closeSavingsSheet();
        return;
      }

      const updated = await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId: settings.id,
          [balanceField]: 0,
        },
      });
      setSettings(updated);
      closeSavingsSheet();
    } catch (err: unknown) {
      Alert.alert("Could not delete item", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const saveCountry = async (overrideCountry?: string) => {
    if (!settings?.id) return;
    const nextCountry = (overrideCountry ?? countryDraft).trim().toUpperCase();
    if (!nextCountry) {
      Alert.alert("Country required", "Please enter a country code like GB, US or TT.");
      return;
    }

    try {
      setSaveBusy(true);
      const updated = await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId: settings.id,
          country: nextCountry,
        },
      });
      setSettings(updated);
      setLocaleSheetOpen(false);
    } catch (err: unknown) {
      Alert.alert("Could not save locale", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const openDebtEditor = (debt: Debt) => {
    const normalizedType: DebtKind = "credit_card";
    setEditDebtTarget(debt);
    setEditDebtName(debt.name);
    setEditDebtType(normalizedType);
    setEditDebtInitialBalance(asMoneyInput(debt.initialBalance));
    setEditDebtBalance(asMoneyInput(debt.currentBalance));
    setEditDebtLimit(asMoneyInput(debt.creditLimit));
    setEditDebtMonthlyPayment(asMoneyInput(typeof debt.amount === "number" ? String(debt.amount) : debt.amount));
    setEditDebtInterestRate(asMoneyInput(debt.interestRate));
  };

  const saveDebtEdit = async () => {
    if (!editDebtTarget) return;

    const name = editDebtName.trim();
    const debtType: DebtKind = "credit_card";
    const currentBalance = Number(editDebtBalance || editDebtInitialBalance);
    const creditLimit = Number(editDebtLimit || 0);
    const interestRate = editDebtInterestRate.trim() ? Number(editDebtInterestRate.trim()) : null;

    if (!name) {
      Alert.alert("Name required", "Enter a debt name.");
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      Alert.alert("Invalid balance", "Enter a valid balance.");
      return;
    }
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      Alert.alert("Invalid interest rate", "Enter a valid interest rate (0 or more).");
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit <= 0) {
      Alert.alert("Invalid limit", "Credit cards require a valid credit limit.");
      return;
    }
    try {
      setSaveBusy(true);
      const body: Record<string, unknown> = {
        name,
        type: debtType,
        currentBalance,
        interestRate,
        creditLimit,
      };

      const updated = await apiFetch<Debt>(`/api/bff/debts/${encodeURIComponent(editDebtTarget.id)}`, {
        method: "PATCH",
        body,
      });
      setDebts((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setEditDebtTarget(null);
    } catch (err: unknown) {
      Alert.alert("Could not update debt", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const addDebt = async () => {
    if (!settings?.id) return;
    const name = addDebtName.trim();
    const debtType: DebtKind = "credit_card";
    const initialBalance = Number(addDebtBalance || addDebtInitialBalance);
    const currentBalance = Number(addDebtBalance || addDebtInitialBalance);
    const limit = Number(addDebtLimit || 0);
    const interestRate = addDebtInterestRate.trim() ? Number(addDebtInterestRate.trim()) : null;
    if (!name) {
      Alert.alert("Name required", "Enter a debt name.");
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      Alert.alert("Invalid balance", "Enter a valid balance.");
      return;
    }
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      Alert.alert("Invalid interest rate", "Enter a valid interest rate (0 or more).");
      return;
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      Alert.alert("Invalid limit", "Credit cards require a valid credit limit.");
      return;
    }
    try {
      setSaveBusy(true);
      const body: Record<string, unknown> = {
        budgetPlanId: settings.id,
        name,
        type: debtType,
        initialBalance,
        currentBalance,
        amount: 0,
        interestRate,
        creditLimit: limit,
      };

      await apiFetch("/api/bff/debts", {
        method: "POST",
        body,
      });
      setAddDebtName("");
      setAddDebtInitialBalance("");
      setAddDebtBalance("");
      setAddDebtLimit("");
      setAddDebtMonthlyPayment("");
      setAddDebtInterestRate("");
      setAddDebtType("credit_card");
      setAddDebtSheetOpen(false);
      await switchPlan(settings.id);
    } catch (err: unknown) {
      Alert.alert("Could not add debt", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const createSubPlan = async () => {
    const name = newPlanName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter a plan name.");
      return;
    }
    const eventDateRaw = newPlanEventDate.trim();
    const eventDate = normalizeDateToYmd(eventDateRaw);
    if (!eventDate) {
      Alert.alert("Event date required", "Pick an event date from the calendar.");
      return;
    }

    try {
      setSaveBusy(true);
      await apiFetch("/api/bff/budget-plans", {
        method: "POST",
        body: {
          kind: newPlanType,
          name,
          eventDate,
        },
      });
      setCreatePlanSheetOpen(false);
      setNewPlanName("");
      setNewPlanType("holiday");
      setNewPlanEventDate("");
      await load();
    } catch (err: unknown) {
      Alert.alert("Could not create plan", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!planDeleteTarget) return;
    try {
      setDeletingPlanId(planDeleteTarget.id);
      await apiFetch(`/api/bff/budget-plans/${encodeURIComponent(planDeleteTarget.id)}`, { method: "DELETE" });
      setPlanDeleteTarget(null);
      await load();
      if (currentPlanId === planDeleteTarget.id) {
        setActiveTab("plans");
      }
    } catch (err: unknown) {
      Alert.alert("Could not delete plan", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDeletingPlanId(null);
    }
  };

  const isMoneyTab = activeTab === "savings";
  const moneyScrollTopPadding = Math.max(0, topHeaderOffset - MONEY_TOP_OFFSET_REDUCTION);
  const safeTopPadding = isMoneyTab ? 0 : topHeaderOffset;
  const moneyToggleTranslateX = moneyToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MONEY_TOGGLE_SEGMENT_WIDTH],
  });

  return {
    insets,
    topHeaderOffset,
    authUsername,
    signOut,
    profile,
    settings,
    plans,
    loading,
    refreshing,
    setRefreshing,
    error,
    noPlan,
    activeTab,
    setActiveTab,
    moneyViewMode,
    setMoneyViewMode,
    moreOpen,
    setMoreOpen,
    notifications,
    notificationInbox,
    detailsSheetOpen,
    setDetailsSheetOpen,
    budgetFieldSheet,
    setBudgetFieldSheet,
    savingsSheetField,
    savingsSheetMode,
    savingsEditingPotId,
    localeSheetOpen,
    setLocaleSheetOpen,
    addDebtSheetOpen,
    setAddDebtSheetOpen,
    createPlanSheetOpen,
    setCreatePlanSheetOpen,
    saveBusy,
    switchingPlanId,
    deletingPlanId,
    planDeleteTarget,
    setPlanDeleteTarget,
    emailDraft,
    setEmailDraft,
    countryDraft,
    setCountryDraft,
    payDateDraft,
    setPayDateDraft,
    horizonDraft,
    setHorizonDraft,
    payFrequencyDraft,
    setPayFrequencyDraft,
    billFrequencyDraft,
    setBillFrequencyDraft,
    strategyDraft,
    savingsValueDraft,
    setSavingsValueDraft,
    savingsPotNameDraft,
    setSavingsPotNameDraft,
    editDebtTarget,
    editDebtSheetDragY,
    editDebtSheetPanHandlers,
    addDebtSheetDragY,
    addDebtSheetPanHandlers,
    localeSheetDragY,
    localeSheetPanHandlers,
    detailsSheetDragY,
    detailsSheetPanHandlers,
    budgetFieldSheetDragY,
    budgetFieldSheetPanHandlers,
    savingsSheetDragY,
    savingsSheetPanHandlers,
    createPlanSheetDragY,
    createPlanSheetPanHandlers,
    editDebtName,
    setEditDebtName,
    editDebtBalance,
    setEditDebtBalance,
    editDebtLimit,
    setEditDebtLimit,
    editDebtInterestRate,
    setEditDebtInterestRate,
    addDebtName,
    setAddDebtName,
    addDebtBalance,
    setAddDebtBalance,
    addDebtLimit,
    setAddDebtLimit,
    addDebtInterestRate,
    setAddDebtInterestRate,
    newPlanName,
    setNewPlanName,
    newPlanType,
    setNewPlanType,
    newPlanEventDate,
    setNewPlanEventDate,
    showPlanEventDatePicker,
    setShowPlanEventDatePicker,
    iosPlanEventDraft,
    setIosPlanEventDraft,
    currentPlan,
    currentPlanId,
    detectedCountry,
    cur,
    savingsCards,
    savingsPotsByField,
    creditCardGroups,
    storeCardGroups,
    savingsSheetCurrentAmount,
    savingsSheetIcon,
    savingsSheetGoalImpactNote,
    isMoreTabActive,
    isMoneyTab,
    moneyScrollTopPadding,
    safeTopPadding,
    moneyToggleTranslateX,
    closeDetailsSheet,
    closeBudgetFieldSheet,
    closeSavingsSheet,
    closeEditDebtSheet,
    closeLocaleSheet,
    closeAddDebtSheet,
    closeCreatePlanSheet,
    openPlanEventDatePicker,
    cancelPlanEventDatePicker,
    closePlanEventDatePicker,
    load,
    loadNotifications,
    formatNotificationReceivedAt,
    saveNotifications,
    createPersonalPlan,
    switchPlan,
    saveDetails,
    saveBudgetField,
    openSavingsField,
    openSavingsEditor,
    saveSavingsField,
    deleteSavingsItem,
    saveCountry,
    openDebtEditor,
    saveDebtEdit,
    addDebt,
    createSubPlan,
    confirmDeletePlan,
    markNotificationInboxItemRead,
    deleteNotificationInboxItem,
  };
}

export type SettingsScreenController = ReturnType<typeof useSettingsScreenController>;

export default useSettingsScreenController;
