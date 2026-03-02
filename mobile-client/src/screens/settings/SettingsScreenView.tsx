import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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
import * as Notifications from "expo-notifications";

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
import {
  deleteNotificationInboxItem,
  markNotificationInboxItemRead,
  subscribeNotificationInbox,
  type NotificationInboxItem,
} from "@/lib/notificationInbox";
import type { MainTabScreenProps } from "@/navigation/types";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import MoneyInput from "@/components/Shared/MoneyInput";
import DatePickerInput from "@/components/Shared/DatePickerInput";
import SettingsDebtGroups from "@/components/Settings/SettingsDebtGroups";
import { useSettingsDebtBuckets } from "@/lib/hooks/useSettingsDebtBuckets";

type SettingsTab = "details" | "budget" | "savings" | "locale" | "plans" | "notifications" | "danger";
type PlanKind = "personal" | "holiday" | "carnival";
type DebtKind = "credit_card" | "loan" | "hire_purchase";
type PayFrequency = "monthly" | "every_2_weeks" | "weekly";
type BillFrequency = "monthly" | "every_2_weeks";
type BudgetField = "payDate" | "horizon" | "payFrequency" | "billFrequency";
type SavingsField = "savings" | "emergency" | "investment";
type MoneyViewMode = "personal" | "cards";

type SavingsPot = {
  id: string;
  field: SavingsField;
  name: string;
  amount: number;
  allocationId?: string;
};

type SavingsPotStore = Record<string, SavingsPot[]>;

type NotificationPrefs = {
  dueReminders: boolean;
  paymentAlerts: boolean;
  dailyTips: boolean;
};

type NotificationPrefsResponse = {
  ok?: boolean;
  dueReminders?: boolean;
  paymentAlerts?: boolean;
  dailyTips?: boolean;
};

type CreateSacrificeItemResponse = {
  success?: boolean;
  item?: {
    id?: string;
  };
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
  { id: "savings", label: "Money" },
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
  savings: { active: "logo-usd", inactive: "logo-usd" },
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

const PAY_FREQUENCY_OPTIONS: Array<{ value: PayFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "every_2_weeks", label: "Every 2 weeks" },
  { value: "weekly", label: "Weekly" },
];

const BILL_FREQUENCY_OPTIONS: Array<{ value: BillFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "every_2_weeks", label: "Every 2 weeks" },
];

const SAVINGS_TILE_SIZE = Math.min(122, Math.max(94, Math.floor(Dimensions.get("window").width * 0.30)));
const MONEY_TOGGLE_WIDTH = Math.max(220, Dimensions.get("window").width - 32);
const MONEY_TOGGLE_TRACK_PADDING = 4;
const MONEY_TOGGLE_SEGMENT_WIDTH = (MONEY_TOGGLE_WIDTH - MONEY_TOGGLE_TRACK_PADDING * 2) / 2;
const MONEY_TOP_OFFSET_REDUCTION = 8;
const SAVINGS_CARD_GREEN = "#2EF2B3";
const EMERGENCY_CARD_RED = "#FF9E96";
const INVESTMENT_CARD_BLUE = "#9EC9FF";

function getSavingsTilePalette(field: SavingsField): {
  cardBg: string;
  borderColor: string;
  iconBg: string;
  titleColor: string;
  valueColor: string;
  hintColor: string;
  plusColor: string;
} {
  if (field === "emergency") {
    return {
      cardBg: EMERGENCY_CARD_RED,
      borderColor: "rgba(86,19,22,0.17)",
      iconBg: "rgba(86,19,22,0.15)",
      titleColor: "#5a1316",
      valueColor: "#3f0d11",
      hintColor: "#7a262c",
      plusColor: "#3f0d11",
    };
  }
  if (field === "investment") {
    return {
      cardBg: INVESTMENT_CARD_BLUE,
      borderColor: "rgba(17,45,82,0.18)",
      iconBg: "rgba(17,45,82,0.13)",
      titleColor: "#1b3f6d",
      valueColor: "#122c4b",
      hintColor: "#295a96",
      plusColor: "#122c4b",
    };
  }
  return {
    cardBg: SAVINGS_CARD_GREEN,
    borderColor: "rgba(11,46,62,0.16)",
    iconBg: "rgba(8,44,66,0.16)",
    titleColor: "#0b2e3e",
    valueColor: "#071f34",
    hintColor: "#123e56",
    plusColor: "#071f34",
  };
}

function getAddPotLabel(field: SavingsField): string {
  if (field === "savings") return "Add Saving";
  if (field === "emergency") return "Add Emergency";
  return "Add Investment";
}

function mapSavingsFieldToSacrificeType(field: SavingsField): "savings" | "emergency" | "investment" {
  if (field === "emergency") return "emergency";
  if (field === "investment") return "investment";
  return "savings";
}

function formatPayFrequency(value: unknown): string {
  if (value === "weekly") return "Weekly";
  if (value === "every_2_weeks") return "Every 2 weeks";
  return "Monthly";
}

function formatBillFrequency(value: unknown): string {
  if (value === "every_2_weeks") return "Every 2 weeks";
  return "Monthly";
}

const NOTIFICATION_PREFS_KEY = "budget_app.notification_prefs";
const SAVINGS_POTS_KEY = "budget_app.savings_pots.v1";

function parseSavingsPotStore(raw: string | null): SavingsPotStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: SavingsPotStore = {};
    for (const [planId, pots] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(pots)) continue;
      next[planId] = pots
        .map((pot) => {
          if (!pot || typeof pot !== "object") return null;
          const rec = pot as Record<string, unknown>;
          const field = rec.field;
          const name = typeof rec.name === "string" ? rec.name.trim() : "";
          const amountRaw = rec.amount;
          const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
          if ((field !== "savings" && field !== "emergency" && field !== "investment") || !name || !Number.isFinite(amount) || amount < 0) {
            return null;
          }
          return {
            id: typeof rec.id === "string" && rec.id ? rec.id : `${planId}-${name.toLowerCase().replace(/\s+/g, "-")}`,
            field,
            name,
            amount,
            allocationId: typeof rec.allocationId === "string" && rec.allocationId.trim() ? rec.allocationId.trim() : undefined,
          } as SavingsPot;
        })
        .filter((pot): pot is SavingsPot => Boolean(pot));
    }
    return next;
  } catch {
    return {};
  }
}

async function readSavingsPotsForPlan(planId: string): Promise<SavingsPot[]> {
  const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
  const store = parseSavingsPotStore(raw);
  return Array.isArray(store[planId]) ? store[planId] : [];
}

async function writeSavingsPotsForPlan(planId: string, pots: SavingsPot[]): Promise<void> {
  const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
  const store = parseSavingsPotStore(raw);
  store[planId] = pots;
  await SecureStore.setItemAsync(SAVINGS_POTS_KEY, JSON.stringify(store));
}

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
  const [moneyViewMode, setMoneyViewMode] = useState<MoneyViewMode>("personal");
  const moneyToggleAnim = React.useRef(new Animated.Value(0)).current;
  const [moreOpen, setMoreOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationPrefs>({ dueReminders: true, paymentAlerts: true, dailyTips: true });
  const [notificationInbox, setNotificationInbox] = useState<NotificationInboxItem[]>([]);

  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [budgetFieldSheet, setBudgetFieldSheet] = useState<BudgetField | null>(null);
  const [savingsSheetField, setSavingsSheetField] = useState<SavingsField | null>(null);
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

  const [editDebtTarget, setEditDebtTarget] = useState<Debt | null>(null);

  const closeDetailsSheet = useCallback(() => setDetailsSheetOpen(false), []);
  const closeBudgetFieldSheet = useCallback(() => setBudgetFieldSheet(null), []);
  const closeSavingsSheet = useCallback(() => {
    setSavingsSheetField(null);
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
    (async () => {
      const stored = await getStoredThemeMode();
      setThemeMode(stored ?? "dark");
    })();
  }, []);

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
  }, [settings?.id]);

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
    setSavingsSheetField(field);
    setSavingsValueDraft("");
    setSavingsPotNameDraft("");
  };

  const saveSavingsField = async () => {
    if (!settings?.id || !savingsSheetField) return;

    const potName = savingsPotNameDraft.trim();
    if (!potName) {
      Alert.alert("Pot name required", "Enter a name for this savings pot.");
      return;
    }

    const value = Number(savingsValueDraft || 0);
    if (!Number.isFinite(value) || value <= 0) {
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

    return (
      <SafeAreaView style={[styles.safe, { paddingTop: safeTopPadding }]} edges={[]}>
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
            contentContainerStyle={[
              styles.scroll,
              isMoneyTab ? [styles.scrollNoTop, { paddingTop: moneyScrollTopPadding }] : null,
            ]}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
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

                <View style={styles.twoColRow}>
                  <Pressable
                    onPress={() => setBudgetFieldSheet("payFrequency")}
                    style={[styles.infoCard, styles.halfCard]}
                  >
                    <View style={styles.cardMiniActionRow}>
                      <View />
                      <View style={styles.cardMiniIconBtn}>
                        <Ionicons name="pencil-outline" size={13} color={T.textDim} />
                      </View>
                    </View>
                    <Text style={styles.infoCardLabel}>Pay schedule</Text>
                    <Text style={styles.infoCardValue}>{formatPayFrequency(settings?.payFrequency)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setBudgetFieldSheet("billFrequency")}
                    style={[styles.infoCard, styles.halfCard]}
                  >
                    <View style={styles.cardMiniActionRow}>
                      <View />
                      <View style={styles.cardMiniIconBtn}>
                        <Ionicons name="pencil-outline" size={13} color={T.textDim} />
                      </View>
                    </View>
                    <Text style={styles.infoCardLabel}>Bill schedule</Text>
                    <Text style={styles.infoCardValue}>{formatBillFrequency(settings?.billFrequency)}</Text>
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
              <View style={styles.moneyTabSurface}>
                <View style={styles.moneyToggleWrap}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.moneyToggleThumb,
                      {
                        transform: [{ translateX: moneyToggleTranslateX }],
                      },
                    ]}
                  />
                  <Pressable
                    onPress={() => setMoneyViewMode("personal")}
                    style={styles.moneyTogglePill}
                  >
                    <Text style={[styles.moneyToggleTxt, moneyViewMode === "personal" && styles.moneyToggleTxtActive]}>Personal</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMoneyViewMode("cards")}
                    style={styles.moneyTogglePill}
                  >
                    <Text style={[styles.moneyToggleTxt, moneyViewMode === "cards" && styles.moneyToggleTxtActive]}>Cards</Text>
                  </Pressable>
                </View>

                {moneyViewMode === "personal" ? (
                  <View style={styles.plainSavingsBlock}>
                    {savingsCards.map((card) => (
                      <View key={card.key} style={styles.moneySectionCard}>
                        <View style={styles.savingsSectionStack}>
                          <Text style={styles.savingsSectionTitle}>{card.title}</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.savingsTilesRow}
                            decelerationRate="fast"
                            snapToInterval={SAVINGS_TILE_SIZE + 12}
                            snapToAlignment="start"
                          >
                            {(() => {
                              const palette = getSavingsTilePalette(card.key);
                              return (
                                <Pressable
                                  onPress={() => openSavingsField(card.key)}
                                  style={[
                                    styles.savingsTileCard,
                                    {
                                      width: SAVINGS_TILE_SIZE,
                                      height: SAVINGS_TILE_SIZE,
                                      backgroundColor: palette.cardBg,
                                      borderColor: palette.borderColor,
                                    },
                                  ]}
                                >
                                  <View style={styles.savingsTileTopRow}>
                                    <View style={[styles.savingsTileIconWrap, { backgroundColor: palette.iconBg }]}>
                                      <Ionicons name={card.icon} size={18} color={palette.valueColor} />
                                    </View>
                                  </View>
                                  <Text style={[styles.savingsTileValue, { color: palette.valueColor }]}>{cur}{asMoneyText(card.total)}</Text>
                                  <Text style={[styles.savingsTileHint, { color: palette.hintColor }]}>Base {cur}{asMoneyText(card.base)} + monthly {cur}{asMoneyText(card.monthly)}</Text>
                                </Pressable>
                              );
                            })()}
                            {savingsPotsByField[card.key].map((pot) => (
                              <View
                                key={pot.id}
                                style={[
                                  styles.savingsTileCard,
                                  {
                                    width: SAVINGS_TILE_SIZE,
                                    height: SAVINGS_TILE_SIZE,
                                    backgroundColor: getSavingsTilePalette(card.key).cardBg,
                                    borderColor: getSavingsTilePalette(card.key).borderColor,
                                  },
                                ]}
                              >
                                <View style={styles.savingsTileTopRow}>
                                  <View style={[styles.savingsTileIconWrap, { backgroundColor: getSavingsTilePalette(card.key).iconBg }]}>
                                    <Ionicons name={card.icon} size={18} color={getSavingsTilePalette(card.key).valueColor} />
                                  </View>
                                </View>
                                <Text style={[styles.savingsTileTitle, { color: getSavingsTilePalette(card.key).titleColor }]}>{pot.name}</Text>
                                <Text style={[styles.savingsTileValue, { color: getSavingsTilePalette(card.key).valueColor }]}>{cur}{asMoneyText(pot.amount)}</Text>
                              </View>
                            ))}
                            <Pressable
                              onPress={() => openSavingsField(card.key)}
                              style={[
                                styles.savingsTileAddCard,
                                {
                                  width: SAVINGS_TILE_SIZE,
                                  height: SAVINGS_TILE_SIZE,
                                  backgroundColor: getSavingsTilePalette(card.key).cardBg,
                                  borderColor: getSavingsTilePalette(card.key).borderColor,
                                },
                              ]}
                              accessibilityLabel={`Add more ${card.title.toLowerCase()}`}
                            >
                              <Ionicons name="add" size={30} color={getSavingsTilePalette(card.key).plusColor} />
                              <Text style={[styles.savingsTileAddText, { color: getSavingsTilePalette(card.key).plusColor }]}>
                                {getAddPotLabel(card.key)}
                              </Text>
                            </Pressable>
                          </ScrollView>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.plainSavingsBlock}>
                    <View style={styles.moneySectionCard}>
                      <View style={styles.plainSectionHeadRow}>
                        <Text style={styles.plainBudgetTitle}>Credit cards</Text>
                        <Pressable onPress={() => setAddDebtSheetOpen(true)} style={styles.circleAddBtn}>
                          <Ionicons name="add" size={20} color={T.onAccent} />
                        </Pressable>
                      </View>
                      {creditCardGroups.length === 0 ? (
                        <Text style={styles.muted}>No credit cards in this plan yet.</Text>
                      ) : (
                        <SettingsDebtGroups
                          groupedDebts={creditCardGroups}
                          currency={cur}
                          asMoneyInput={asMoneyInput}
                          onOpenDebtEditor={openDebtEditor}
                        />
                      )}
                    </View>

                    <View style={styles.moneySectionCard}>
                      <View style={styles.plainSectionHeadRow}>
                        <Text style={styles.plainBudgetTitle}>Store cards</Text>
                      </View>
                      {storeCardGroups.length === 0 ? (
                        <Text style={styles.muted}>No store cards in this plan yet.</Text>
                      ) : (
                        <SettingsDebtGroups
                          groupedDebts={storeCardGroups}
                          currency={cur}
                          asMoneyInput={asMoneyInput}
                          onOpenDebtEditor={openDebtEditor}
                        />
                      )}
                    </View>
                  </View>
                )}
              </View>
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
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Daily tips</Text>
                  <Switch
                    value={notifications.dailyTips}
                    onValueChange={(v) => { void saveNotifications({ ...notifications, dailyTips: v }); }}
                    trackColor={{ false: T.border, true: T.accentFaint }}
                    thumbColor={notifications.dailyTips ? T.accent : T.card}
                  />
                </View>
                <Text style={[styles.muted, styles.notificationHeading]}>Recent notifications</Text>
                {notificationInbox.length ? (
                  <View style={styles.notificationList}>
                    {notificationInbox.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          if (item.readAt) return;
                          void markNotificationInboxItemRead(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.notificationItem,
                          !item.readAt && styles.notificationItemUnread,
                          pressed && styles.notificationItemPressed,
                        ]}
                      >
                        <View style={styles.notificationTitleRow}>
                          <Text style={styles.notificationTitle} numberOfLines={1}>
                            {item.title || "BudgetIn Check"}
                          </Text>
                          {!item.readAt ? <View style={styles.notificationUnreadDot} /> : null}
                        </View>
                        {item.body ? <Text style={styles.notificationBody}>{item.body}</Text> : null}
                        <View style={styles.notificationFooterRow}>
                          <Text style={styles.notificationMeta}>{formatNotificationReceivedAt(item.receivedAt)}</Text>
                          <View style={styles.notificationActions}>
                            {!item.readAt ? (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  void markNotificationInboxItemRead(item.id);
                                }}
                                style={styles.notificationActionBtn}
                              >
                                <Text style={styles.notificationActionText}>Mark read</Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                void deleteNotificationInboxItem(item.id);
                              }}
                              style={styles.notificationDeleteBtn}
                              accessibilityLabel="Delete notification"
                            >
                              <Ionicons name="trash-outline" size={14} color={T.red} />
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.notificationEmpty}>No notifications yet.</Text>
                )}
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
            <Text style={styles.sheetTitle}>
              {budgetFieldSheet === "payDate"
                ? "Edit pay date"
                : budgetFieldSheet === "horizon"
                  ? "Edit budget horizon"
                  : budgetFieldSheet === "payFrequency"
                    ? "Edit pay schedule"
                    : "Edit bill schedule"}
            </Text>
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
            {budgetFieldSheet === "payFrequency" ? (
              <>
                <Text style={styles.label}>Pay schedule</Text>
                <View style={styles.choiceRow}>
                  {PAY_FREQUENCY_OPTIONS.map((opt) => {
                    const selected = payFrequencyDraft === opt.value;
                    return (
                      <Pressable key={opt.value} onPress={() => setPayFrequencyDraft(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                        <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            {budgetFieldSheet === "billFrequency" ? (
              <>
                <Text style={styles.label}>Bill schedule</Text>
                <View style={styles.choiceRow}>
                  {BILL_FREQUENCY_OPTIONS.map((opt) => {
                    const selected = billFrequencyDraft === opt.value;
                    return (
                      <Pressable key={opt.value} onPress={() => setBillFrequencyDraft(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                        <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
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
            <Text style={styles.sheetTitle}>Add {savingsSheetField ?? ""} pot</Text>
            <Text style={styles.label}>Pot name</Text>
            <TextInput
              value={savingsPotNameDraft}
              onChangeText={setSavingsPotNameDraft}
              style={styles.input}
              placeholder="e.g. Holiday, Car repairs"
              placeholderTextColor={T.textMuted}
            />
            <Text style={styles.label}>Amount</Text>
            <MoneyInput currency={settings?.currency} value={savingsValueDraft} onChangeValue={setSavingsValueDraft} />
            <Text style={styles.muted}>This creates a named pot and adds the amount to your current balance.</Text>
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
          <KeyboardAvoidingView
            style={styles.sheetKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? Math.max(0, topHeaderOffset - insets.top) : 0}
          >
            <Animated.View style={[styles.sheet, styles.sheetTall, { transform: [{ translateY: editDebtSheetDragY }] }]}> 
              <View style={styles.sheetHandle} {...editDebtSheetPanHandlers} />
              <Text style={styles.sheetTitle}>Edit credit card</Text>
              <View style={styles.sheetBody}>
                <ScrollView
                  style={styles.sheetScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  <Text style={styles.label}>Name</Text>
                  <TextInput value={editDebtName} onChangeText={setEditDebtName} style={styles.input} />

                  <Text style={styles.label}>Balance</Text>
                  <MoneyInput currency={settings?.currency} value={editDebtBalance} onChangeValue={setEditDebtBalance} />

                  <Text style={styles.label}>Interest rate % (optional)</Text>
                  <TextInput value={editDebtInterestRate} onChangeText={setEditDebtInterestRate} style={styles.input} keyboardType="decimal-pad" />

                  <Text style={styles.label}>Credit limit</Text>
                  <MoneyInput currency={settings?.currency} value={editDebtLimit} onChangeValue={setEditDebtLimit} />
                </ScrollView>

                <View style={[styles.sheetActionsDocked, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
                  <Pressable style={styles.outlineBtnWide} onPress={closeEditDebtSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
                  <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveDebtEdit} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView
            style={styles.sheetKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? Math.max(0, topHeaderOffset - insets.top) : 0}
          >
            <Animated.View style={[styles.sheet, styles.sheetTall, { transform: [{ translateY: addDebtSheetDragY }] }]}>
              <View style={styles.sheetHandle} {...addDebtSheetPanHandlers} />
              <Text style={styles.sheetTitle}>Add credit card</Text>
              <View style={styles.sheetBody}>
                <ScrollView
                  style={styles.sheetScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  <Text style={styles.label}>Name</Text>
                  <TextInput value={addDebtName} onChangeText={setAddDebtName} style={styles.input} />

                  <Text style={styles.label}>Balance</Text>
                  <MoneyInput currency={settings?.currency} value={addDebtBalance} onChangeValue={setAddDebtBalance} />

                  <Text style={styles.label}>Interest rate % (optional)</Text>
                  <TextInput value={addDebtInterestRate} onChangeText={setAddDebtInterestRate} style={styles.input} keyboardType="decimal-pad" />

                  <Text style={styles.label}>Credit limit</Text>
                  <MoneyInput currency={settings?.currency} value={addDebtLimit} onChangeValue={setAddDebtLimit} />
                </ScrollView>

                <View style={[styles.sheetActionsDocked, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
                  <Pressable style={styles.outlineBtnWide} onPress={closeAddDebtSheet}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
                  <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={addDebt} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Add"}</Text></Pressable>
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
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
            <DatePickerInput
              containerStyle={[styles.input, styles.dateInput]}
              onPress={openPlanEventDatePicker}
              value={newPlanEventDate ? formatDateDmy(newPlanEventDate) : ""}
              valueStyle={styles.dateValue}
              placeholderStyle={styles.dateValuePlaceholder}
            />

            {showPlanEventDatePicker && Platform.OS === "android" ? (
              <View style={{ marginBottom: 6 }}>
                <DateTimePicker
                  value={newPlanEventDate ? new Date(`${newPlanEventDate}T00:00:00`) : new Date()}
                  mode="date"
                  display="calendar"
                  minimumDate={new Date()}
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
                minimumDate={new Date()}
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
  scrollNoTop: { paddingTop: 0 },

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
  moneyToggleWrap: {
    flexDirection: "row",
    width: MONEY_TOGGLE_WIDTH,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    padding: MONEY_TOGGLE_TRACK_PADDING,
    marginBottom: 20,
    position: "relative",
  },
  moneyToggleThumb: {
    position: "absolute",
    left: MONEY_TOGGLE_TRACK_PADDING,
    top: MONEY_TOGGLE_TRACK_PADDING,
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    height: 33,
    borderRadius: 999,
    backgroundColor: `${T.accent}30`,
    borderWidth: 1,
    borderColor: `${T.accent}73`,
  },
  moneyTogglePill: {
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    borderRadius: 999,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  moneyToggleTxt: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  moneyToggleTxtActive: {
    color: T.text,
  },
  moneySectionCard: {
    ...cardBase,
    padding: 12,
    marginBottom: 12,
  },
  moneyTabSurface: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
    marginBottom: 8,
  },
  savingsTilesRow: {
    gap: 12,
    paddingRight: 2,
  },
  savingsSectionStack: {
    marginBottom: 0,
  },
  savingsSectionTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  savingsTileCard: {
    ...cardBase,
    backgroundColor: SAVINGS_CARD_GREEN,
    borderColor: "rgba(11,46,62,0.16)",
    borderRadius: 16,
    padding: 12,
    justifyContent: "space-between",
  },
  savingsTileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  savingsTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,44,66,0.16)",
  },
  savingsTileAddCard: {
    ...cardBase,
    backgroundColor: SAVINGS_CARD_GREEN,
    borderColor: "rgba(11,46,62,0.16)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  savingsTileAddText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  savingsTileTitle: {
    color: "#0b2e3e",
    fontSize: 13,
    fontWeight: "800",
  },
  savingsTileValue: {
    color: "#071f34",
    fontSize: 24,
    fontWeight: "900",
  },
  savingsTileHint: {
    color: "#123e56",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
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
    width: 34,
    height: 34,
    borderRadius: 10,
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
  notificationList: {
    gap: 8,
    marginTop: 0,
    marginBottom: 8,
  },
  notificationHeading: {
    marginBottom: 6,
  },
  notificationItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  notificationItemPressed: {
    opacity: 0.9,
  },
  notificationItemUnread: {
    borderColor: `${T.accent}80`,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.red,
  },
  notificationBody: {
    color: T.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  notificationMeta: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  notificationFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationActionBtn: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  notificationActionText: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  notificationDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.red}14`,
  },
  notificationEmpty: {
    color: T.textMuted,
    fontSize: 12,
  },

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
  sheetKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
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
  sheetTall: {
    height: "88%",
    maxHeight: "90%",
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    gap: 8,
    paddingBottom: 10,
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
  sheetActionsDocked: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.card,
  },
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
