import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Updates from "expo-updates";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch, getApiBaseUrl } from "@/lib/api";
import type {
  BudgetPlanListItem,
  BudgetPlansResponse,
  Debt,
  Settings,
  UserProfile,
} from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { getStoredThemeMode, setStoredThemeMode } from "@/lib/storage";
import { applyThemeMode, T, type ThemeMode } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import type { MainTabScreenProps } from "@/navigation/types";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import SettingsDebtGroups from "@/components/Settings/SettingsDebtGroups";
import { useSettingsDebtBuckets } from "@/lib/hooks/useSettingsDebtBuckets";

type SettingsTab = "details" | "budget" | "savings" | "locale" | "plans" | "notifications" | "danger";
type PlanKind = "personal" | "holiday" | "carnival";
type DebtKind = "credit_card" | "loan" | "hire_purchase";
type BudgetField = "payDate" | "horizon";
type SavingsField = "savings" | "emergency" | "investment";

type NotificationPrefs = {
  dueReminders: boolean;
  paymentAlerts: boolean;
};

type NotificationPrefsResponse = {
  ok?: boolean;
  dueReminders?: boolean;
  paymentAlerts?: boolean;
};

function formatDateDmy(dateYmd: string): string {
  const s = (dateYmd || "").trim();
  if (!s) return "";
  return s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
}

function normalizeDateToYmd(value: string): string | null {
  const s = (value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

const PRIMARY_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "budget", label: "Budget" },
  { id: "savings", label: "Savings" },
  { id: "plans", label: "Plans" },
];

const MORE_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "locale", label: "Locale" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger Zone" },
];

const TAB_ICONS: Record<SettingsTab, { active: React.ComponentProps<typeof Ionicons>["name"]; inactive: React.ComponentProps<typeof Ionicons>["name"] }> = {
  details: { active: "person", inactive: "person-outline" },
  budget: { active: "wallet", inactive: "wallet-outline" },
  savings: { active: "cash", inactive: "cash-outline" },
  plans: { active: "list", inactive: "list-outline" },
  locale: { active: "globe", inactive: "globe-outline" },
  notifications: { active: "notifications", inactive: "notifications-outline" },
  danger: { active: "warning", inactive: "warning-outline" },
};

const STRATEGY_OPTIONS = [
  { value: "payYourselfFirst", label: "Pay Yourself First", tip: "Prioritise savings and investment before discretionary spending." },
  { value: "zeroBased", label: "Zero-based", tip: "Assign every pound to a category so leftover becomes £0." },
  { value: "fiftyThirtyTwenty", label: "50/30/20", tip: "Split income into needs, wants, and savings/debt reduction." },
] as const;

const NOTIFICATION_PREFS_KEY = "budget_app.notification_prefs";

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function parseLocaleCountry(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = String(locale).replace("_", "-").split("-");
    const region = parts.find((p) => p.length === 2 && p.toUpperCase() === p);
    return region ?? null;
  } catch {
    return null;
  }
}

function asMoneyInput(value: string | null | undefined): string {
  if (!value) return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function asMoneyNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asMoneyText(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function SettingsScreen({ navigation, route }: MainTabScreenProps<"Settings">) {
  const topHeaderOffset = useTopHeaderOffset();
  const insets = useSafeAreaInsets();
  const { username: authUsername, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<BudgetPlanListItem[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPlan, setNoPlan] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [activeTab, setActiveTab] = useState<SettingsTab>("details");
  const [moreOpen, setMoreOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationPrefs>({ dueReminders: true, paymentAlerts: true });

  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [budgetFieldSheet, setBudgetFieldSheet] = useState<BudgetField | null>(null);
  const [savingsSheetField, setSavingsSheetField] = useState<SavingsField | null>(null);
  const [localeSheetOpen, setLocaleSheetOpen] = useState(false);
  const [addDebtSheetOpen, setAddDebtSheetOpen] = useState(false);
  const [createPlanSheetOpen, setCreatePlanSheetOpen] = useState(false);

  const [saveBusy, setSaveBusy] = useState(false);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [switchingPlanId, setSwitchingPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [planDeleteTarget, setPlanDeleteTarget] = useState<BudgetPlanListItem | null>(null);

  const [emailDraft, setEmailDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");

  const [payDateDraft, setPayDateDraft] = useState("");
  const [horizonDraft, setHorizonDraft] = useState("");
  const [strategyDraft, setStrategyDraft] = useState("payYourselfFirst");
  const [savingsValueDraft, setSavingsValueDraft] = useState("");

  const [editDebtTarget, setEditDebtTarget] = useState<Debt | null>(null);

  const closeDetailsSheet = useCallback(() => setDetailsSheetOpen(false), []);
  const closeBudgetFieldSheet = useCallback(() => setBudgetFieldSheet(null), []);
  const closeSavingsSheet = useCallback(() => setSavingsSheetField(null), []);
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
  const [editDebtHistoricalPaid, setEditDebtHistoricalPaid] = useState("");
  const [editDebtMonthlyPayment, setEditDebtMonthlyPayment] = useState("");
  const [editDebtInstallmentMonths, setEditDebtInstallmentMonths] = useState("");
  const [editDebtInterestRate, setEditDebtInterestRate] = useState("");
  const [editDebtAgreementFirstPaymentDate, setEditDebtAgreementFirstPaymentDate] = useState("");
  const [editDebtAgreementMissedMonths, setEditDebtAgreementMissedMonths] = useState("");
  const [editDebtAgreementMissedFee, setEditDebtAgreementMissedFee] = useState("");

  const [showEditAgreementDatePicker, setShowEditAgreementDatePicker] = useState(false);
  const editAgreementBeforeRef = React.useRef<string>("");
  const [iosEditAgreementDraft, setIosEditAgreementDraft] = useState<Date>(new Date());

  const [addDebtName, setAddDebtName] = useState("");
  const [addDebtType, setAddDebtType] = useState<DebtKind>("credit_card");
  const [addDebtInitialBalance, setAddDebtInitialBalance] = useState("");
  const [addDebtBalance, setAddDebtBalance] = useState("");
  const [addDebtLimit, setAddDebtLimit] = useState("");
  const [addDebtHistoricalPaid, setAddDebtHistoricalPaid] = useState("");
  const [addDebtMonthlyPayment, setAddDebtMonthlyPayment] = useState("");
  const [addDebtInstallmentMonths, setAddDebtInstallmentMonths] = useState("");
  const [addDebtInterestRate, setAddDebtInterestRate] = useState("");
  const [addDebtAgreementFirstPaymentDate, setAddDebtAgreementFirstPaymentDate] = useState("");
  const [addDebtAgreementMissedMonths, setAddDebtAgreementMissedMonths] = useState("");
  const [addDebtAgreementMissedFee, setAddDebtAgreementMissedFee] = useState("");

  const [showAddAgreementDatePicker, setShowAddAgreementDatePicker] = useState(false);
  const addAgreementBeforeRef = React.useRef<string>("");
  const [iosAddAgreementDraft, setIosAddAgreementDraft] = useState<Date>(new Date());

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanType, setNewPlanType] = useState<PlanKind>("holiday");
  const [newPlanEventDate, setNewPlanEventDate] = useState("");

  const [showPlanEventDatePicker, setShowPlanEventDatePicker] = useState(false);
  const planEventBeforeRef = React.useRef<string>("");
  const [iosPlanEventDraft, setIosPlanEventDraft] = useState<Date>(new Date());

  const openEditAgreementDatePicker = useCallback(() => {
    editAgreementBeforeRef.current = editDebtAgreementFirstPaymentDate;
    setIosEditAgreementDraft(editDebtAgreementFirstPaymentDate ? new Date(`${editDebtAgreementFirstPaymentDate}T00:00:00`) : new Date());
    setShowEditAgreementDatePicker(true);
  }, [editDebtAgreementFirstPaymentDate]);

  const cancelEditAgreementDatePicker = useCallback(() => {
    setShowEditAgreementDatePicker(false);
    if (editAgreementBeforeRef.current !== editDebtAgreementFirstPaymentDate) {
      setEditDebtAgreementFirstPaymentDate(editAgreementBeforeRef.current);
    }
  }, [editDebtAgreementFirstPaymentDate]);

  const closeEditAgreementDatePicker = useCallback(() => {
    setEditDebtAgreementFirstPaymentDate(iosEditAgreementDraft.toISOString().slice(0, 10));
    setShowEditAgreementDatePicker(false);
  }, [iosEditAgreementDraft]);

  const openAddAgreementDatePicker = useCallback(() => {
    addAgreementBeforeRef.current = addDebtAgreementFirstPaymentDate;
    setIosAddAgreementDraft(addDebtAgreementFirstPaymentDate ? new Date(`${addDebtAgreementFirstPaymentDate}T00:00:00`) : new Date());
    setShowAddAgreementDatePicker(true);
  }, [addDebtAgreementFirstPaymentDate]);

  const cancelAddAgreementDatePicker = useCallback(() => {
    setShowAddAgreementDatePicker(false);
    if (addAgreementBeforeRef.current !== addDebtAgreementFirstPaymentDate) {
      setAddDebtAgreementFirstPaymentDate(addAgreementBeforeRef.current);
    }
  }, [addDebtAgreementFirstPaymentDate]);

  const closeAddAgreementDatePicker = useCallback(() => {
    setAddDebtAgreementFirstPaymentDate(iosAddAgreementDraft.toISOString().slice(0, 10));
    setShowAddAgreementDatePicker(false);
  }, [iosAddAgreementDraft]);

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

  let apiBase = "";
  try {
    apiBase = getApiBaseUrl();
  } catch {
    apiBase = "";
  }

  const isMoreTabActive = MORE_TABS.some((tab) => tab.id === activeTab);

  const loadNotifications = useCallback(async () => {
    const readFromSecureStore = async () => {
      try {
        const raw = await SecureStore.getItemAsync(NOTIFICATION_PREFS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as NotificationPrefs;
        if (typeof parsed?.dueReminders === "boolean" && typeof parsed?.paymentAlerts === "boolean") {
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
      if (typeof remote?.dueReminders === "boolean" && typeof remote?.paymentAlerts === "boolean") {
        const next = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
        };
        setNotifications(next);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
        return;
      }
    } catch {
      await readFromSecureStore();
    }
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
        },
      });

      if (typeof remote?.dueReminders === "boolean" && typeof remote?.paymentAlerts === "boolean") {
        const synced = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
        };
        setNotifications(synced);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(synced));
      }
    } catch (err: unknown) {
      Alert.alert("Notification settings", err instanceof Error ? err.message : "Failed to sync settings.");
    }
  }, []);

  const sendTestMobilePush = useCallback(async () => {
    try {
      setPushTestBusy(true);
      const result = await apiFetch<{
        ok: boolean;
        sent: number;
        totalTokens: number;
        removedTokens: number;
        errors?: string[];
      }>("/api/notifications/test-mobile", {
        method: "POST",
        body: {
          title: "BudgetIn Check",
          body: "Test mobile notification",
        },
      });

      const errors = Array.isArray(result.errors) ? result.errors : [];
      const summary = [
        `Sent: ${result.sent}/${result.totalTokens}`,
        `Removed stale tokens: ${result.removedTokens}`,
      ];

      if (errors.length > 0) {
        summary.push("", "Delivery errors:", ...errors.slice(0, 5));
      }

      Alert.alert("Push test complete", summary.join("\n"));
    } catch (err: unknown) {
      Alert.alert("Push test failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPushTestBusy(false);
    }
  }, []);

  const hydrateDrafts = useCallback((nextSettings: Settings | null, nextProfile: UserProfile | null) => {
    setEmailDraft(nextProfile?.email ?? "");
    setCountryDraft((nextSettings?.country ?? "").toUpperCase());
    setPayDateDraft(nextSettings?.payDate ? String(nextSettings.payDate) : "");
    setHorizonDraft(currentPlan?.budgetHorizonYears ? String(currentPlan.budgetHorizonYears) : "10");
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

  useEffect(() => {
    const requestedTab = (route as unknown as { params?: { initialTab?: unknown } } | undefined)?.params?.initialTab;
    if (requestedTab === "notifications") {
      setActiveTab("notifications");
    }
  }, [route]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    (async () => {
      const stored = await getStoredThemeMode();
      setThemeMode(stored ?? "dark");
    })();
  }, []);

  const toggleTheme = async (nextIsDark: boolean) => {
    const next: ThemeMode = nextIsDark ? "dark" : "light";
    setThemeMode(next);
    await setStoredThemeMode(next);
    applyThemeMode(next);
    try {
      await Updates.reloadAsync();
    } catch {
      // noop in production fallback
    }
  };

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

      setBudgetFieldSheet(null);
      await load();
    } catch (err: unknown) {
      Alert.alert("Could not save budget settings", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const openSavingsField = (field: SavingsField) => {
    setSavingsSheetField(field);
    setSavingsValueDraft("");
  };

  const saveSavingsField = async () => {
    if (!settings?.id || !savingsSheetField) return;

    const value = Number(savingsValueDraft || 0);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Enter an additional amount greater than 0.");
      return;
    }

    try {
      setSaveBusy(true);
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

      setSettings(updated);
      setSavingsSheetField(null);
    } catch (err: unknown) {
      Alert.alert("Could not add amount", err instanceof Error ? err.message : "Please try again.");
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
    const normalizedType = debt.type === "loan" || debt.type === "hire_purchase" ? debt.type : "credit_card";
    setEditDebtTarget(debt);
    setEditDebtName(debt.name);
    setEditDebtType(normalizedType);
    setEditDebtInitialBalance(asMoneyInput(debt.initialBalance));
    setEditDebtBalance(asMoneyInput(debt.currentBalance));
    setEditDebtLimit(asMoneyInput(debt.creditLimit));
    setEditDebtHistoricalPaid(asMoneyInput(debt.historicalPaidAmount));
    setEditDebtMonthlyPayment(asMoneyInput(typeof debt.amount === "number" ? String(debt.amount) : debt.amount));
    setEditDebtInstallmentMonths(debt.installmentMonths ? String(debt.installmentMonths) : "");
    setEditDebtInterestRate(asMoneyInput(debt.interestRate));
    setEditDebtAgreementFirstPaymentDate("");
    setEditDebtAgreementMissedMonths("");
    setEditDebtAgreementMissedFee("");
  };

  const saveDebtEdit = async () => {
    if (!editDebtTarget) return;

    const name = editDebtName.trim();
    const initialBalance = Number(editDebtInitialBalance || editDebtBalance);
    const currentBalance = Number(editDebtBalance || editDebtInitialBalance);
    const creditLimit = Number(editDebtLimit || 0);
    const historicalPaidAmount = Number(editDebtHistoricalPaid || 0);
    const monthlyPayment = Number(editDebtMonthlyPayment || 0);
    const installmentMonths = editDebtInstallmentMonths.trim() ? Number.parseInt(editDebtInstallmentMonths.trim(), 10) : null;
    const interestRate = editDebtInterestRate.trim() ? Number(editDebtInterestRate.trim()) : null;
    const agreementFirstPaymentDateRaw = editDebtAgreementFirstPaymentDate.trim();
    const agreementFirstPaymentDate = agreementFirstPaymentDateRaw ? normalizeDateToYmd(agreementFirstPaymentDateRaw) : "";
    const agreementMissedMonths = editDebtAgreementMissedMonths.trim() ? Number.parseInt(editDebtAgreementMissedMonths.trim(), 10) : 0;
    const agreementMissedPaymentFee = editDebtAgreementMissedFee.trim() ? Number(editDebtAgreementMissedFee.trim()) : 0;

    if (!name) {
      Alert.alert("Name required", "Enter a debt name.");
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      Alert.alert("Invalid balance", "Enter a valid current balance.");
      return;
    }
    if (editDebtType === "credit_card" && (!Number.isFinite(creditLimit) || creditLimit <= 0)) {
      Alert.alert("Invalid limit", "Credit cards require a valid credit limit.");
      return;
    }
    if (editDebtType !== "credit_card") {
      if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
        Alert.alert("Invalid initial amount", "Loans require a valid initial amount greater than 0.");
        return;
      }
      if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
        Alert.alert("Invalid monthly payment", "Loans require a valid monthly payment greater than 0.");
        return;
      }
      if (installmentMonths !== null && (!Number.isFinite(installmentMonths) || installmentMonths <= 0)) {
        Alert.alert("Invalid agreement months", "Enter a valid number of agreement months.");
        return;
      }
      if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
        Alert.alert("Invalid interest rate", "Enter a valid APR (0 or more).");
        return;
      }
      if (agreementFirstPaymentDateRaw && !agreementFirstPaymentDate) {
        Alert.alert("Invalid first payment date", "Pick a date from the calendar.");
        return;
      }
      if (!Number.isFinite(agreementMissedMonths) || agreementMissedMonths < 0) {
        Alert.alert("Invalid missed months", "Enter 0 or more missed months.");
        return;
      }
      if (!Number.isFinite(agreementMissedPaymentFee) || agreementMissedPaymentFee < 0) {
        Alert.alert("Invalid missed fee", "Enter 0 or more.");
        return;
      }
    }
    if (!Number.isFinite(historicalPaidAmount) || historicalPaidAmount < 0) {
      Alert.alert("Invalid paid amount", "Enter a valid paid-so-far amount (0 or more).");
      return;
    }

    try {
      setSaveBusy(true);
      const body: Record<string, unknown> = {
        name,
        type: editDebtType,
        currentBalance,
        creditLimit: editDebtType === "credit_card" ? creditLimit : null,
      };

      if (editDebtType !== "credit_card") {
        body.initialBalance = initialBalance;
        body.amount = monthlyPayment;
        body.installmentMonths = installmentMonths;
        body.interestRate = interestRate;
        if (agreementFirstPaymentDate) {
          body.agreementFirstPaymentDate = agreementFirstPaymentDate;
          body.agreementMissedMonths = agreementMissedMonths;
          body.agreementMissedPaymentFee = agreementMissedPaymentFee;
        } else {
          body.historicalPaidAmount = historicalPaidAmount;
        }
      } else {
        body.historicalPaidAmount = historicalPaidAmount;
      }

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
    const initialBalance = Number(addDebtType === "credit_card" ? addDebtBalance : addDebtInitialBalance || addDebtBalance);
    const currentBalance = Number(addDebtBalance || addDebtInitialBalance);
    const limit = Number(addDebtLimit || 0);
    const historicalPaidAmount = Number(addDebtHistoricalPaid || 0);
    const monthlyPayment = Number(addDebtMonthlyPayment || 0);
    const installmentMonths = addDebtInstallmentMonths.trim() ? Number.parseInt(addDebtInstallmentMonths.trim(), 10) : null;
    const interestRate = addDebtInterestRate.trim() ? Number(addDebtInterestRate.trim()) : null;
    const agreementFirstPaymentDateRaw = addDebtAgreementFirstPaymentDate.trim();
    const agreementFirstPaymentDate = agreementFirstPaymentDateRaw ? normalizeDateToYmd(agreementFirstPaymentDateRaw) : "";
    const agreementMissedMonths = addDebtAgreementMissedMonths.trim() ? Number.parseInt(addDebtAgreementMissedMonths.trim(), 10) : 0;
    const agreementMissedPaymentFee = addDebtAgreementMissedFee.trim() ? Number(addDebtAgreementMissedFee.trim()) : 0;
    if (!name) {
      Alert.alert("Name required", "Enter a debt name.");
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      Alert.alert("Invalid balance", "Enter a valid current balance.");
      return;
    }
    if (addDebtType === "credit_card" && (!Number.isFinite(limit) || limit <= 0)) {
      Alert.alert("Invalid limit", "Credit cards require a valid credit limit.");
      return;
    }
    if (addDebtType !== "credit_card") {
      if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
        Alert.alert("Invalid initial amount", "Loans require a valid initial amount greater than 0.");
        return;
      }
      if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
        Alert.alert("Invalid monthly payment", "Loans require a valid monthly payment greater than 0.");
        return;
      }
      if (installmentMonths !== null && (!Number.isFinite(installmentMonths) || installmentMonths <= 0)) {
        Alert.alert("Invalid agreement months", "Enter a valid number of agreement months.");
        return;
      }
      if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
        Alert.alert("Invalid interest rate", "Enter a valid APR (0 or more).");
        return;
      }
      if (agreementFirstPaymentDateRaw && !agreementFirstPaymentDate) {
        Alert.alert("Invalid first payment date", "Pick a date from the calendar.");
        return;
      }
      if (!Number.isFinite(agreementMissedMonths) || agreementMissedMonths < 0) {
        Alert.alert("Invalid missed months", "Enter 0 or more missed months.");
        return;
      }
      if (!Number.isFinite(agreementMissedPaymentFee) || agreementMissedPaymentFee < 0) {
        Alert.alert("Invalid missed fee", "Enter 0 or more.");
        return;
      }
    }
    if (!Number.isFinite(historicalPaidAmount) || historicalPaidAmount < 0) {
      Alert.alert("Invalid paid amount", "Enter a valid paid-so-far amount (0 or more).");
      return;
    }

    try {
      setSaveBusy(true);
      const body: Record<string, unknown> = {
        budgetPlanId: settings.id,
        name,
        type: addDebtType,
        initialBalance: addDebtType === "credit_card" ? currentBalance : initialBalance,
        currentBalance: addDebtType === "credit_card" ? currentBalance : currentBalance || initialBalance,
        amount: addDebtType === "credit_card" ? currentBalance : monthlyPayment,
        creditLimit: addDebtType === "credit_card" ? limit : null,
        historicalPaidAmount,
      };

      if (addDebtType !== "credit_card") {
        body.installmentMonths = installmentMonths;
        body.interestRate = interestRate;
        if (agreementFirstPaymentDate) {
          body.agreementFirstPaymentDate = agreementFirstPaymentDate;
          body.agreementMissedMonths = agreementMissedMonths;
          body.agreementMissedPaymentFee = agreementMissedPaymentFee;
          // Server will compute historicalPaidAmount and currentBalance.
          delete body.historicalPaidAmount;
        }
      }

      await apiFetch("/api/bff/debts", {
        method: "POST",
        body,
      });
      setAddDebtName("");
      setAddDebtInitialBalance("");
      setAddDebtBalance("");
      setAddDebtLimit("");
      setAddDebtHistoricalPaid("");
      setAddDebtMonthlyPayment("");
      setAddDebtInstallmentMonths("");
      setAddDebtInterestRate("");
      setAddDebtAgreementFirstPaymentDate("");
      setAddDebtAgreementMissedMonths("");
      setAddDebtAgreementMissedFee("");
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

  return (
		<SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={load} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : noPlan ? (
          <View style={styles.center}>
            <Ionicons name="wallet-outline" size={44} color={T.textDim} />
            <Text style={styles.noPlanTitle}>Create your first budget plan</Text>
            <Text style={styles.noPlanText}>You don’t have a plan yet. Create one to start budgeting.</Text>
            <Pressable onPress={createPersonalPlan} style={[styles.primaryBtn, saveBusy && styles.disabled]} disabled={saveBusy}>
              <Text style={styles.primaryBtnText}>{saveBusy ? "Creating…" : "Create Plan"}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === "details" && (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.username ?? authUsername ?? "?").slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{profile?.username ?? authUsername ?? "User"}</Text>
                    <Text style={styles.profileSub}>{profile?.email ?? "No email set"}</Text>
                  </View>
                  <Pressable onPress={() => setDetailsSheetOpen(true)} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Edit</Text></Pressable>
                </View>

                <Section title="Details">
                  <Row label="Username" value={profile?.username ?? authUsername} />
                  <Row label="Email" value={profile?.email ?? "Not set"} />
                  <Row label="Country" value={(settings?.country ?? "").toUpperCase()} />
                </Section>
              </>
            )}

            {activeTab === "budget" && (
              <View style={styles.plainBudgetBlock}>
                <Text style={styles.plainBudgetTitle}>Budget setup</Text>
                <View style={styles.twoColRow}>
                  <Pressable
                    onPress={() => setBudgetFieldSheet("payDate")}
                    style={[styles.infoCard, styles.halfCard]}
                  >
                    <View style={styles.cardMiniActionRow}>
                      <View />
                      <View style={styles.cardMiniIconBtn}>
                        <Ionicons name="pencil-outline" size={13} color={T.textDim} />
                      </View>
                    </View>
                    <Text style={styles.infoCardLabel}>Pay date</Text>
                    <Text style={styles.infoCardValue}>Day {settings?.payDate ?? "-"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setBudgetFieldSheet("horizon")}
                    style={[styles.infoCard, styles.halfCard]}
                  >
                    <View style={styles.cardMiniActionRow}>
                      <View />
                      <View style={styles.cardMiniIconBtn}>
                        <Ionicons name="pencil-outline" size={13} color={T.textDim} />
                      </View>
                    </View>
                    <Text style={styles.infoCardLabel}>Budget horizon</Text>
                    <Text style={styles.infoCardValue}>{currentPlan?.budgetHorizonYears ?? 10} years</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    if (!settings?.id) return;
                    navigation.navigate("SettingsStrategy", {
                      budgetPlanId: settings.id,
                      strategy: strategyDraft,
                    });
                  }}
                  style={styles.infoCard}
                >
                  <View style={styles.cardRowCenter}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoCardLabel}>Strategy</Text>
                      <Text style={styles.infoCardValue}>
                        {STRATEGY_OPTIONS.find((s) => s.value === strategyDraft)?.label ?? "Pay Yourself First"}
                      </Text>
                      <Text style={styles.infoCardHint}>Tap to change strategy and view tips</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={T.textDim} />
                  </View>
                </Pressable>
              </View>
            )}

            {activeTab === "savings" && (
              <>
                <View style={styles.plainSavingsBlock}>
                  <Text style={styles.plainBudgetTitle}>Starting balances</Text>
                  <Pressable onPress={() => openSavingsField("savings")} style={styles.infoCard}>
                    <View style={styles.savingsCardHead}>
                      <View style={styles.savingsIconWrap}>
                        <Ionicons name="wallet-outline" size={14} color={T.textDim} />
                      </View>
                      <Text style={styles.infoCardLabel}>Savings</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{cur}{asMoneyText(savingsTotal)}</Text>
                    <Text style={styles.infoCardHint}>Base {cur}{asMoneyText(savingsBase)} + monthly {cur}{asMoneyText(savingsMonthly)}. Tap to add extra.</Text>
                  </Pressable>
                  <Pressable onPress={() => openSavingsField("emergency")} style={styles.infoCard}>
                    <View style={styles.savingsCardHead}>
                      <View style={styles.savingsIconWrap}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={T.textDim} />
                      </View>
                      <Text style={styles.infoCardLabel}>Emergency</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{cur}{asMoneyText(emergencyTotal)}</Text>
                    <Text style={styles.infoCardHint}>Base {cur}{asMoneyText(emergencyBase)} + monthly {cur}{asMoneyText(emergencyMonthly)}. Tap to add extra.</Text>
                  </Pressable>
                  <Pressable onPress={() => openSavingsField("investment")} style={styles.infoCard}>
                    <View style={styles.savingsCardHead}>
                      <View style={styles.savingsIconWrap}>
                        <Ionicons name="trending-up-outline" size={14} color={T.textDim} />
                      </View>
                      <Text style={styles.infoCardLabel}>Investment</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{cur}{asMoneyText(investmentTotal)}</Text>
                    <Text style={styles.infoCardHint}>Base {cur}{asMoneyText(investmentBase)} + monthly {cur}{asMoneyText(investmentMonthly)}. Tap to add extra.</Text>
                  </Pressable>
                </View>

                <View style={styles.plainSavingsBlock}>
                  <View style={styles.plainSectionHeadRow}>
                    <Text style={styles.plainBudgetTitle}>Cards / Loans / Hire purchase</Text>
                    <Pressable onPress={() => setAddDebtSheetOpen(true)} style={styles.circleAddBtn}>
                      <Ionicons name="add" size={20} color={T.onAccent} />
                    </Pressable>
                  </View>
                  {groupedDebts.length === 0 ? (
                    <Text style={styles.muted}>No debts for this plan yet.</Text>
                  ) : (
                    <SettingsDebtGroups
                      groupedDebts={groupedDebts}
                      currency={cur}
                      asMoneyInput={asMoneyInput}
                      onOpenDebtEditor={openDebtEditor}
                    />
                  )}
                </View>
              </>
            )}

            {activeTab === "locale" && (
              <Section title="Locale" right={<Pressable onPress={() => setLocaleSheetOpen(true)} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Edit</Text></Pressable>}>
                <Row label="Country" value={(settings?.country ?? "").toUpperCase()} />
                <Row label="Language" value={settings?.language} />
                <Row label="Currency" value={settings?.currency} />
                <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
                <Pressable
                  onPress={() => {
                    if (!detectedCountry || !settings?.id) return;
                    if ((settings.country ?? "").toUpperCase() === "GB") return;
                    setCountryDraft(detectedCountry);
                    void saveCountry(detectedCountry);
                  }}
                  style={styles.inlineAction}
                  disabled={!detectedCountry || (settings?.country ?? "").toUpperCase() === "GB"}
                >
                  <Text style={styles.inlineActionText}>Use detected country</Text>
                </Pressable>
                {(settings?.country ?? "").toUpperCase() === "GB" ? <Text style={styles.muted}>UK stays fixed as your home country.</Text> : null}
              </Section>
            )}

            {activeTab === "plans" && (
              <>
                <Section title="Your plans" right={<Text style={styles.muted}>{plans.length} plans</Text>}>
                  {plans.map((plan) => {
                    const isCurrent = plan.id === currentPlanId;
                    const isSubPlan = plan.kind !== "personal";
                    const switching = switchingPlanId === plan.id;
                    const deleting = deletingPlanId === plan.id;
                    return (
                      <View key={plan.id} style={styles.planRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planName}>{plan.name}</Text>
                          <Text style={styles.planSub}>{String(plan.kind).replace("_", " ")}{isCurrent ? " · Current" : ""}</Text>
                        </View>
                        <Pressable onPress={() => switchPlan(plan.id)} style={styles.outlineBtn} disabled={isCurrent || switching}>
                          <Text style={styles.outlineBtnText}>{isCurrent ? "Current" : switching ? "..." : "Manage"}</Text>
                        </Pressable>
                        {isSubPlan ? (
                          <Pressable onPress={() => setPlanDeleteTarget(plan)} style={styles.trashBtn} disabled={deleting}>
                            <Ionicons name="trash-outline" size={16} color={T.red} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </Section>

                <Section title="Add another plan">
                  <Pressable onPress={() => { setNewPlanType("holiday"); setCreatePlanSheetOpen(true); }} style={styles.primaryGhostBtn}>
                    <Text style={styles.primaryGhostText}>Create Holiday plan</Text>
                  </Pressable>
                  <Pressable onPress={() => { setNewPlanType("carnival"); setCreatePlanSheetOpen(true); }} style={styles.primaryGhostBtn}>
                    <Text style={styles.primaryGhostText}>Create Carnival plan</Text>
                  </Pressable>
                </Section>
              </>
            )}

            {activeTab === "notifications" && (
              <Section title="Notifications">
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Due reminders</Text>
                  <Switch
                    value={notifications.dueReminders}
                    onValueChange={(v) => { void saveNotifications({ ...notifications, dueReminders: v }); }}
                    trackColor={{ false: T.border, true: T.accentFaint }}
                    thumbColor={notifications.dueReminders ? T.accent : T.card}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Payment alerts</Text>
                  <Switch
                    value={notifications.paymentAlerts}
                    onValueChange={(v) => { void saveNotifications({ ...notifications, paymentAlerts: v }); }}
                    trackColor={{ false: T.border, true: T.accentFaint }}
                    thumbColor={notifications.paymentAlerts ? T.accent : T.card}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    void sendTestMobilePush();
                  }}
                  style={[styles.primaryGhostBtn, pushTestBusy && styles.disabled]}
                  disabled={pushTestBusy}
                >
                  <Text style={styles.primaryGhostText}>{pushTestBusy ? "Sending…" : "Send test mobile push"}</Text>
                </Pressable>
                <Text style={styles.muted}>These preferences sync to your account and control automatic reminders.</Text>
              </Section>
            )}

            {activeTab === "danger" && (
              <Section title="Danger Zone">
                <Text style={styles.muted}>Sign out from this device.</Text>
                <Pressable onPress={signOut} style={styles.signOutBtn}>
                  <Ionicons name="log-out-outline" size={18} color={T.red} />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
              </Section>
            )}
          </ScrollView>
        )}
      </View>

      <BlurView intensity={22} tint="dark" style={[styles.bottomTabsGlass, { paddingBottom: Math.max(0, insets.bottom) }]}>
        <View style={styles.bottomTabsTint} />
        <View style={styles.bottomTabs}>
          {PRIMARY_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.bottomTabBtn}>
                <View style={[styles.bottomIconWrap, active && styles.bottomIconWrapActive]}>
                  <Ionicons name={active ? TAB_ICONS[tab.id].active : TAB_ICONS[tab.id].inactive} size={18} color={active ? T.text : T.textDim} />
                </View>
                {!active ? <Text style={styles.bottomTabTxt}>{tab.label}</Text> : null}
              </Pressable>
            );
          })}
          <Pressable onPress={() => setMoreOpen(true)} style={styles.bottomTabBtn}>
            <View style={[styles.bottomIconWrap, isMoreTabActive && styles.bottomIconWrapActive]}>
              <Ionicons
                name={isMoreTabActive ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"}
                size={18}
                color={isMoreTabActive ? T.text : T.textDim}
              />
            </View>
            {!isMoreTabActive ? <Text style={styles.bottomTabTxt}>More</Text> : null}
          </Pressable>
        </View>
      </BlurView>

      <Modal transparent visible={moreOpen} animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <View style={styles.moreBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMoreOpen(false)} />
          <View style={styles.moreMenu}>
            {MORE_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id);
                    setMoreOpen(false);
                  }}
                  style={[styles.moreMenuItem, active && styles.moreMenuItemActive]}
                >
                  <Text style={[styles.moreMenuTxt, active && styles.moreMenuTxtActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={detailsSheetOpen} animationType="slide" onRequestClose={closeDetailsSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetailsSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: detailsSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...detailsSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Edit details</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput value={profile?.username ?? authUsername ?? ""} editable={false} style={styles.inputDisabled} />
            <Text style={styles.label}>Email</Text>
            <TextInput value={emailDraft} onChangeText={setEmailDraft} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeDetailsSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveDetails} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={budgetFieldSheet !== null} animationType="slide" onRequestClose={closeBudgetFieldSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeBudgetFieldSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: budgetFieldSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...budgetFieldSheetPanHandlers} />
            <Text style={styles.sheetTitle}>{budgetFieldSheet === "payDate" ? "Edit pay date" : "Edit budget horizon"}</Text>
            {budgetFieldSheet === "payDate" ? (
              <>
                <Text style={styles.label}>Pay date</Text>
                <TextInput value={payDateDraft} onChangeText={setPayDateDraft} style={styles.input} keyboardType="number-pad" />
              </>
            ) : null}
            {budgetFieldSheet === "horizon" ? (
              <>
                <Text style={styles.label}>Budget horizon (years)</Text>
                <TextInput value={horizonDraft} onChangeText={setHorizonDraft} style={styles.input} keyboardType="number-pad" />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeBudgetFieldSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveBudgetField} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={savingsSheetField !== null} animationType="slide" onRequestClose={closeSavingsSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSavingsSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: savingsSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...savingsSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Add to {savingsSheetField ?? ""} balance</Text>
            <Text style={styles.label}>Additional amount</Text>
            <TextInput value={savingsValueDraft} onChangeText={setSavingsValueDraft} style={styles.input} keyboardType="decimal-pad" />
            <Text style={styles.muted}>This adds to your current balance and updates matching goal progress.</Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeSavingsSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveSavingsField} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Add"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={!!editDebtTarget} animationType="slide" onRequestClose={closeEditDebtSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditDebtSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: editDebtSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...editDebtSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Edit card / loan</Text>
            <Text style={styles.label}>Type</Text>
            <View style={styles.choiceRow}>
              {([
                { label: "Card", value: "credit_card" },
                { label: "Loan", value: "loan" },
                { label: "Hire purchase", value: "hire_purchase" },
              ] as Array<{ label: string; value: DebtKind }>).map((opt) => {
                const selected = editDebtType === opt.value;
                return (
                  <Pressable key={opt.value} onPress={() => setEditDebtType(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                    <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput value={editDebtName} onChangeText={setEditDebtName} style={styles.input} />

            <View style={styles.twoColRow}>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Current balance</Text>
                <TextInput value={editDebtBalance} onChangeText={setEditDebtBalance} style={styles.input} keyboardType="decimal-pad" />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Paid so far (optional)</Text>
                <TextInput value={editDebtHistoricalPaid} onChangeText={setEditDebtHistoricalPaid} style={styles.input} keyboardType="decimal-pad" />
              </View>
            </View>

            {editDebtType !== "credit_card" ? (
              <>
                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Initial amount</Text>
                    <TextInput value={editDebtInitialBalance} onChangeText={setEditDebtInitialBalance} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Monthly payment</Text>
                    <TextInput value={editDebtMonthlyPayment} onChangeText={setEditDebtMonthlyPayment} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Agreement months</Text>
                    <TextInput value={editDebtInstallmentMonths} onChangeText={setEditDebtInstallmentMonths} style={styles.input} keyboardType="number-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>APR % (optional)</Text>
                    <TextInput value={editDebtInterestRate} onChangeText={setEditDebtInterestRate} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>

                <Text style={styles.label}>1st payment date (calendar, optional)</Text>
                <Pressable style={[styles.input, styles.dateInput]} onPress={openEditAgreementDatePicker}>
                  <Text style={[styles.dateValue, !editDebtAgreementFirstPaymentDate && styles.dateValuePlaceholder]}>
                    {editDebtAgreementFirstPaymentDate ? formatDateDmy(editDebtAgreementFirstPaymentDate) : "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={T.accent} />
                </Pressable>

                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Missed months (optional)</Text>
                    <TextInput value={editDebtAgreementMissedMonths} onChangeText={setEditDebtAgreementMissedMonths} style={styles.input} keyboardType="number-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Missed payment fee (optional)</Text>
                    <TextInput value={editDebtAgreementMissedFee} onChangeText={setEditDebtAgreementMissedFee} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>
              </>
            ) : null}
            {editDebtType === "credit_card" ? (
              <>
                <Text style={styles.label}>Credit limit</Text>
                <TextInput value={editDebtLimit} onChangeText={setEditDebtLimit} style={styles.input} keyboardType="decimal-pad" />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeEditDebtSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveDebtEdit} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={localeSheetOpen} animationType="slide" onRequestClose={closeLocaleSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeLocaleSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: localeSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...localeSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Edit locale</Text>
            <Text style={styles.label}>Country code</Text>
            <TextInput value={countryDraft} onChangeText={(v) => setCountryDraft(v.toUpperCase())} style={styles.input} autoCapitalize="characters" maxLength={3} />
            <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeLocaleSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={() => { void saveCountry(); }} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={addDebtSheetOpen} animationType="slide" onRequestClose={closeAddDebtSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAddDebtSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: addDebtSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...addDebtSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Add card / loan / hire purchase</Text>
            <Text style={styles.label}>Type</Text>
            <View style={styles.choiceRow}>
              {([
                { label: "Card", value: "credit_card" },
                { label: "Loan", value: "loan" },
                { label: "Hire purchase", value: "hire_purchase" },
              ] as Array<{ label: string; value: DebtKind }>).map((opt) => {
                const selected = addDebtType === opt.value;
                return (
                  <Pressable key={opt.value} onPress={() => setAddDebtType(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                    <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput value={addDebtName} onChangeText={setAddDebtName} style={styles.input} />

            <View style={styles.twoColRow}>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Current balance</Text>
                <TextInput value={addDebtBalance} onChangeText={setAddDebtBalance} style={styles.input} keyboardType="decimal-pad" />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Paid so far (optional)</Text>
                <TextInput value={addDebtHistoricalPaid} onChangeText={setAddDebtHistoricalPaid} style={styles.input} keyboardType="decimal-pad" />
              </View>
            </View>

            {addDebtType !== "credit_card" ? (
              <>
                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Initial amount</Text>
                    <TextInput value={addDebtInitialBalance} onChangeText={setAddDebtInitialBalance} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Monthly payment</Text>
                    <TextInput value={addDebtMonthlyPayment} onChangeText={setAddDebtMonthlyPayment} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Agreement months</Text>
                    <TextInput value={addDebtInstallmentMonths} onChangeText={setAddDebtInstallmentMonths} style={styles.input} keyboardType="number-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>APR % (optional)</Text>
                    <TextInput value={addDebtInterestRate} onChangeText={setAddDebtInterestRate} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>

                <Text style={styles.label}>1st payment date (calendar, optional)</Text>
                <Pressable style={[styles.input, styles.dateInput]} onPress={openAddAgreementDatePicker}>
                  <Text style={[styles.dateValue, !addDebtAgreementFirstPaymentDate && styles.dateValuePlaceholder]}>
                    {addDebtAgreementFirstPaymentDate ? formatDateDmy(addDebtAgreementFirstPaymentDate) : "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={T.accent} />
                </Pressable>

                <View style={styles.twoColRow}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Missed months (optional)</Text>
                    <TextInput value={addDebtAgreementMissedMonths} onChangeText={setAddDebtAgreementMissedMonths} style={styles.input} keyboardType="number-pad" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Missed payment fee (optional)</Text>
                    <TextInput value={addDebtAgreementMissedFee} onChangeText={setAddDebtAgreementMissedFee} style={styles.input} keyboardType="decimal-pad" />
                  </View>
                </View>
              </>
            ) : null}
            {addDebtType === "credit_card" ? (
              <>
                <Text style={styles.label}>Credit limit</Text>
                <TextInput value={addDebtLimit} onChangeText={setAddDebtLimit} style={styles.input} keyboardType="decimal-pad" />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeAddDebtSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={addDebt} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Add"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={createPlanSheetOpen} animationType="slide" onRequestClose={closeCreatePlanSheet}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCreatePlanSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: createPlanSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...createPlanSheetPanHandlers} />
            <Text style={styles.sheetTitle}>Create sub plan</Text>
            <Text style={styles.label}>Type</Text>
            <View style={styles.choiceRow}>
              {([
                { label: "Holiday", value: "holiday" },
                { label: "Carnival", value: "carnival" },
              ] as Array<{ label: string; value: PlanKind }>).map((opt) => {
                const selected = newPlanType === opt.value;
                return (
                  <Pressable key={opt.value} onPress={() => setNewPlanType(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                    <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Plan name</Text>
            <TextInput value={newPlanName} onChangeText={setNewPlanName} style={styles.input} />
            <Text style={styles.label}>Event date (calendar)</Text>
            <Pressable style={[styles.input, styles.dateInput]} onPress={openPlanEventDatePicker}>
              <Text style={[styles.dateValue, !newPlanEventDate && styles.dateValuePlaceholder]}>
                {newPlanEventDate ? formatDateDmy(newPlanEventDate) : "Select date"}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={T.accent} />
            </Pressable>

            {showPlanEventDatePicker && Platform.OS === "android" ? (
              <View style={{ marginBottom: 6 }}>
                <DateTimePicker
                  value={newPlanEventDate ? new Date(`${newPlanEventDate}T00:00:00`) : new Date()}
                  mode="date"
                  display="calendar"
                  onChange={(event, selectedDate) => {
                    setShowPlanEventDatePicker(false);
                    if (event.type === "set" && selectedDate) setNewPlanEventDate(selectedDate.toISOString().slice(0, 10));
                  }}
                />
              </View>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={closeCreatePlanSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={createSubPlan} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Creating…" : "Create"}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <DeleteConfirmSheet
        visible={!!planDeleteTarget}
        title="Delete sub plan"
        description={`Delete ${planDeleteTarget?.name ?? "this plan"}? This cannot be undone.`}
        confirmText={deletingPlanId ? "Deleting…" : "Delete"}
        isBusy={!!deletingPlanId}
        onClose={() => setPlanDeleteTarget(null)}
        onConfirm={() => {
          void confirmDeletePlan();
        }}
      />

      {/* Agreement 1st payment date pickers */}
      {showEditAgreementDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={editDebtAgreementFirstPaymentDate ? new Date(`${editDebtAgreementFirstPaymentDate}T00:00:00`) : new Date()}
          mode="date"
          display="calendar"
          onChange={(event, selectedDate) => {
            setShowEditAgreementDatePicker(false);
            if (event.type === "set" && selectedDate) setEditDebtAgreementFirstPaymentDate(selectedDate.toISOString().slice(0, 10));
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={showEditAgreementDatePicker}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={cancelEditAgreementDatePicker}
        >
          <View style={styles.dateModalOverlay}>
            <Pressable style={styles.dateModalBackdrop} onPress={cancelEditAgreementDatePicker} />
            <View style={styles.dateModalSheet}>
              <View style={styles.dateModalHeader}>
                <Pressable onPress={cancelEditAgreementDatePicker}><Text style={styles.dateModalCancelTxt}>Cancel</Text></Pressable>
                <Pressable onPress={closeEditAgreementDatePicker}><Text style={styles.dateModalDoneTxt}>Done</Text></Pressable>
              </View>
              <DateTimePicker
                value={iosEditAgreementDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                onChange={(event, selectedDate) => {
                  const next =
                    selectedDate ??
                    // Some iOS inline picker versions only provide a timestamp on the event.
                    (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                  if (next) setIosEditAgreementDraft(next);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {showAddAgreementDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={addDebtAgreementFirstPaymentDate ? new Date(`${addDebtAgreementFirstPaymentDate}T00:00:00`) : new Date()}
          mode="date"
          display="calendar"
          onChange={(event, selectedDate) => {
            setShowAddAgreementDatePicker(false);
            if (event.type === "set" && selectedDate) setAddDebtAgreementFirstPaymentDate(selectedDate.toISOString().slice(0, 10));
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={showAddAgreementDatePicker}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={cancelAddAgreementDatePicker}
        >
          <View style={styles.dateModalOverlay}>
            <Pressable style={styles.dateModalBackdrop} onPress={cancelAddAgreementDatePicker} />
            <View style={styles.dateModalSheet}>
              <View style={styles.dateModalHeader}>
                <Pressable onPress={cancelAddAgreementDatePicker}><Text style={styles.dateModalCancelTxt}>Cancel</Text></Pressable>
                <Pressable onPress={closeAddAgreementDatePicker}><Text style={styles.dateModalDoneTxt}>Done</Text></Pressable>
              </View>
              <DateTimePicker
                value={iosAddAgreementDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                onChange={(event, selectedDate) => {
                  const next =
                    selectedDate ??
                    // Some iOS inline picker versions only provide a timestamp on the event.
                    (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                  if (next) setIosAddAgreementDraft(next);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Plan event date picker (iOS) */}
      {Platform.OS === "ios" ? (
        <Modal
          visible={showPlanEventDatePicker}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={cancelPlanEventDatePicker}
        >
          <View style={styles.dateModalOverlay}>
            <Pressable style={styles.dateModalBackdrop} onPress={cancelPlanEventDatePicker} />
            <View style={styles.dateModalSheet}>
              <View style={styles.dateModalHeader}>
                <Pressable onPress={cancelPlanEventDatePicker}><Text style={styles.dateModalCancelTxt}>Cancel</Text></Pressable>
                <Pressable onPress={closePlanEventDatePicker}><Text style={styles.dateModalDoneTxt}>Done</Text></Pressable>
              </View>
              <DateTimePicker
                value={iosPlanEventDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                onChange={(event, selectedDate) => {
                  const next =
                    selectedDate ??
                    // Some iOS inline picker versions only provide a timestamp on the event.
                    (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                  if (next) setIosPlanEventDraft(next);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 86 },

  section: {
    ...cardBase,
    padding: 16,
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { color: T.textDim, fontSize: 13, fontWeight: "800" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    gap: 10,
  },
  rowLabel: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  rowValue: { color: T.text, fontSize: 14, fontWeight: "800", maxWidth: "58%", textAlign: "right" },
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },

  profileCard: {
    ...cardElevated,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: T.onAccent, fontSize: 22, fontWeight: "700" },
  profileName: { color: T.text, fontSize: 18, fontWeight: "900" },
  profileSub: { color: T.textDim, fontSize: 13, marginTop: 2, fontWeight: "600" },

  outlineBtn: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  outlineBtnText: { color: T.textDim, fontSize: 12, fontWeight: "800" },

  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryBtnText: { color: T.onAccent, fontWeight: "800", fontSize: 13 },
  inlineAction: { marginTop: 10, alignSelf: "flex-start" },
  inlineActionText: { color: T.accent, fontSize: 12, fontWeight: "800" },

  twoColRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  halfCol: {
    flex: 1,
  },
  plainBudgetBlock: {
    marginBottom: 16,
  },
  plainSavingsBlock: {
    marginBottom: 16,
  },
  plainSectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardMiniActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardMiniIconBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  plainBudgetTitle: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  infoCard: {
    ...cardBase,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    marginBottom: 0,
  },
  infoCardLabel: { color: T.textDim, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  infoCardValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  infoCardHint: { color: T.textDim, fontSize: 12, fontWeight: "600", marginTop: 6 },
  savingsCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  savingsIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  cardRowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },

  circleAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
  },

  debtCard: {
    ...cardBase,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  debtCardBody: {
    flex: 1,
    paddingRight: 4,
  },
  debtTypeBlock: {
    marginBottom: 12,
  },
  debtTypeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  debtTypeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  debtTypeTitle: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  debtTypeCount: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  debtRow: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  debtName: { color: T.text, fontSize: 14, fontWeight: "800" },
  debtSub: { color: T.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
  limitWrap: { marginTop: 8, flexDirection: "row", gap: 8 },
  limitInput: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveMiniBtn: {
    borderRadius: 8,
    backgroundColor: T.accent,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  saveMiniText: { color: T.onAccent, fontWeight: "800", fontSize: 12 },

  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  planName: { color: T.text, fontSize: 14, fontWeight: "800" },
  planSub: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.red}22`,
  },

  primaryGhostBtn: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryGhostText: { color: T.text, fontSize: 16, fontWeight: "800" },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(226,92,92,0.1)",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(226,92,92,0.2)",
  },
  signOutText: { color: T.red, fontSize: 15, fontWeight: "700" },

  bottomTabsGlass: {
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: `${T.accent}29`,
    backgroundColor: `${T.card}A8`,
  },
  bottomTabsTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${T.accent}12`,
  },
  bottomTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  bottomTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  bottomIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomIconWrapActive: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: `${T.accent}30`,
    borderWidth: 1,
    borderColor: `${T.accent}73`,
  },
  bottomTabTxt: { color: T.textDim, fontSize: 11, fontWeight: "700", marginTop: 2 },

  moreBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 12,
  },
  moreMenu: {
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  moreMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  moreMenuItemActive: { backgroundColor: T.accentFaint },
  moreMenuTxt: { color: T.text, fontSize: 14, fontWeight: "700" },
  moreMenuTxtActive: { color: T.accent },

  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 4,
  },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", marginBottom: 6 },
  label: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputDisabled: {
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.textDim,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateValue: { color: T.text, fontWeight: "700" },
  dateValuePlaceholder: { color: T.textDim, fontWeight: "700" },

  dateModalOverlay: { flex: 1, justifyContent: "flex-end" },
  dateModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  dateModalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingBottom: 18,
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  dateModalCancelTxt: { color: T.textDim, fontSize: 16, fontWeight: "700" },
  dateModalDoneTxt: { color: T.accent, fontSize: 16, fontWeight: "800" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  choiceBtn: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceBtnActive: {
    borderColor: T.accent,
    backgroundColor: T.accentFaint,
  },
  choiceTxt: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  choiceTxtActive: { color: T.accent },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  outlineBtnWide: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnWide: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: T.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  tipCard: {
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
  },

  errorText: { color: T.red, fontSize: 14, textAlign: "center" },
  noPlanTitle: { color: T.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  noPlanText: { color: T.textDim, fontSize: 14, textAlign: "center" },
  disabled: { opacity: 0.6 },
});
