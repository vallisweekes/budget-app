import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { getStoredThemeMode, setStoredThemeMode } from "@/lib/storage";
import { applyThemeMode, T, type ThemeMode } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import type { MainTabScreenProps } from "@/navigation/types";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";

type SettingsTab = "details" | "budget" | "savings" | "locale" | "plans" | "notifications" | "danger";
type PlanKind = "personal" | "holiday" | "carnival";
type DebtKind = "credit_card" | "loan" | "hire_purchase";
type DebtGroupKey = "credit_card" | "loan" | "hire_purchase" | "other";
type BudgetField = "payDate" | "horizon";
type SavingsField = "savings" | "emergency" | "investment";

type NotificationPrefs = {
  dueReminders: boolean;
  paymentAlerts: boolean;
};

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

const DEBT_GROUP_META: Array<{ key: DebtGroupKey; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { key: "credit_card", label: "Credit Cards", icon: "card-outline" },
  { key: "loan", label: "Loans", icon: "document-text-outline" },
  { key: "hire_purchase", label: "Hire Purchase", icon: "car-outline" },
  { key: "other", label: "Other", icon: "layers-outline" },
];

function toDebtGroupKey(type: string | null | undefined): DebtGroupKey {
  if (type === "credit_card" || type === "loan" || type === "hire_purchase") return type;
  return "other";
}

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

export default function SettingsScreen({ navigation }: MainTabScreenProps<"Settings">) {
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
  const [editDebtName, setEditDebtName] = useState("");
  const [editDebtType, setEditDebtType] = useState<DebtKind>("credit_card");
  const [editDebtBalance, setEditDebtBalance] = useState("");
  const [editDebtLimit, setEditDebtLimit] = useState("");

  const [addDebtName, setAddDebtName] = useState("");
  const [addDebtType, setAddDebtType] = useState<DebtKind>("credit_card");
  const [addDebtBalance, setAddDebtBalance] = useState("");
  const [addDebtLimit, setAddDebtLimit] = useState("");

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanType, setNewPlanType] = useState<PlanKind>("holiday");
  const [newPlanEventDate, setNewPlanEventDate] = useState("");

  const detectedCountry = useMemo(() => parseLocaleCountry(), []);
  const currentPlanId = settings?.id ?? null;
  const currentPlan = useMemo(() => plans.find((p) => p.id === currentPlanId) ?? null, [plans, currentPlanId]);
  const groupedDebts = useMemo(() => {
    const map: Record<DebtGroupKey, Debt[]> = {
      credit_card: [],
      loan: [],
      hire_purchase: [],
      other: [],
    };
    for (const debt of debts) {
      map[toDebtGroupKey(debt.type)].push(debt);
    }
    return DEBT_GROUP_META
      .map((meta) => ({ ...meta, items: map[meta.key] }))
      .filter((group) => group.items.length > 0);
  }, [debts]);
  const cur = currencySymbol(settings?.currency);

  let apiBase = "";
  try {
    apiBase = getApiBaseUrl();
  } catch {
    apiBase = "";
  }

  const isMoreTabActive = MORE_TABS.some((tab) => tab.id === activeTab);

  const loadNotifications = useCallback(async () => {
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
  }, []);

  const saveNotifications = useCallback(async (next: NotificationPrefs) => {
    setNotifications(next);
    await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
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
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    (async () => {
      const stored = await getStoredThemeMode();
      setThemeMode(stored ?? "dark");
    })();
  }, []);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Dashboard");
  };

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
    if (field === "savings") setSavingsValueDraft(asMoneyInput(settings?.savingsBalance));
    if (field === "emergency") setSavingsValueDraft(asMoneyInput(settings?.emergencyBalance));
    if (field === "investment") setSavingsValueDraft(asMoneyInput(settings?.investmentBalance));
  };

  const saveSavingsField = async () => {
    if (!settings?.id) return;

    const value = Number(savingsValueDraft || 0);
    if (!Number.isFinite(value)) {
      Alert.alert("Invalid values", "Please enter a valid amount.");
      return;
    }

    try {
      setSaveBusy(true);
      const payload: Record<string, number | string> = {
        budgetPlanId: settings.id,
      };
      if (savingsSheetField === "savings") payload.savingsBalance = value;
      if (savingsSheetField === "emergency") payload.emergencyBalance = value;
      if (savingsSheetField === "investment") payload.investmentBalance = value;

      const updated = await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: payload,
      });
      setSettings(updated);
      setSavingsSheetField(null);
    } catch (err: unknown) {
      Alert.alert("Could not save balances", err instanceof Error ? err.message : "Please try again.");
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
    setEditDebtBalance(asMoneyInput(debt.currentBalance));
    setEditDebtLimit(asMoneyInput(debt.creditLimit));
  };

  const saveDebtEdit = async () => {
    if (!editDebtTarget) return;

    const name = editDebtName.trim();
    const currentBalance = Number(editDebtBalance);
    const creditLimit = Number(editDebtLimit || 0);

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

    try {
      setSaveBusy(true);
      const updated = await apiFetch<Debt>(`/api/bff/debts/${encodeURIComponent(editDebtTarget.id)}`, {
        method: "PATCH",
        body: {
          name,
          type: editDebtType,
          currentBalance,
          amount: currentBalance,
          creditLimit: editDebtType === "credit_card" ? creditLimit : null,
        },
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
    const balance = Number(addDebtBalance);
    const limit = Number(addDebtLimit || 0);
    if (!name) {
      Alert.alert("Name required", "Enter a debt name.");
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      Alert.alert("Invalid balance", "Enter a valid current balance.");
      return;
    }
    if (addDebtType === "credit_card" && (!Number.isFinite(limit) || limit <= 0)) {
      Alert.alert("Invalid limit", "Credit cards require a valid credit limit.");
      return;
    }

    try {
      setSaveBusy(true);
      await apiFetch("/api/bff/debts", {
        method: "POST",
        body: {
          budgetPlanId: settings.id,
          name,
          type: addDebtType,
          initialBalance: balance,
          currentBalance: balance,
          amount: balance,
          creditLimit: addDebtType === "credit_card" ? limit : null,
        },
      });
      setAddDebtName("");
      setAddDebtBalance("");
      setAddDebtLimit("");
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
    if (!newPlanEventDate.trim()) {
      Alert.alert("Event date required", "Enter an event date in YYYY-MM-DD format.");
      return;
    }

    try {
      setSaveBusy(true);
      await apiFetch("/api/bff/budget-plans", {
        method: "POST",
        body: {
          kind: newPlanType,
          name,
          eventDate: newPlanEventDate.trim(),
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
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable onPress={signOut} style={styles.headerLogoutBtn}>
          <Ionicons name="log-out-outline" size={16} color={T.red} />
          <Text style={styles.headerLogoutText}>Logout</Text>
        </Pressable>
      </View>

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
                    <Text style={styles.infoCardValue}>{cur}{asMoneyInput(settings?.savingsBalance) || "0"}</Text>
                    <Text style={styles.infoCardHint}>Tap to edit amount</Text>
                  </Pressable>
                  <Pressable onPress={() => openSavingsField("emergency")} style={styles.infoCard}>
                    <View style={styles.savingsCardHead}>
                      <View style={styles.savingsIconWrap}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={T.textDim} />
                      </View>
                      <Text style={styles.infoCardLabel}>Emergency</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{cur}{asMoneyInput(settings?.emergencyBalance) || "0"}</Text>
                    <Text style={styles.infoCardHint}>Tap to edit amount</Text>
                  </Pressable>
                  <Pressable onPress={() => openSavingsField("investment")} style={styles.infoCard}>
                    <View style={styles.savingsCardHead}>
                      <View style={styles.savingsIconWrap}>
                        <Ionicons name="trending-up-outline" size={14} color={T.textDim} />
                      </View>
                      <Text style={styles.infoCardLabel}>Investment</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{cur}{asMoneyInput(settings?.investmentBalance) || "0"}</Text>
                    <Text style={styles.infoCardHint}>Tap to edit amount</Text>
                  </Pressable>
                </View>

                <View style={styles.plainSavingsBlock}>
                  <View style={styles.plainSectionHeadRow}>
                    <Text style={styles.plainBudgetTitle}>Cards / Loans / Hire purchase</Text>
                    <Pressable onPress={() => setAddDebtSheetOpen(true)} style={styles.circleAddBtn}>
                      <Ionicons name="add" size={20} color={T.onAccent} />
                    </Pressable>
                  </View>
                  {debts.length === 0 ? (
                    <Text style={styles.muted}>No debts for this plan yet.</Text>
                  ) : (
                    groupedDebts.map((group) => (
                      <View key={group.key} style={styles.debtTypeBlock}>
                        <View style={styles.debtTypeHead}>
                          <View style={styles.debtTypeIconWrap}>
                            <Ionicons name={group.icon} size={14} color={T.textDim} />
                          </View>
                          <Text style={styles.debtTypeTitle}>{group.label}</Text>
                          <Text style={styles.debtTypeCount}>{group.items.length}</Text>
                        </View>

                        {group.items.map((debt) => (
                          <Pressable key={debt.id} style={styles.debtCard} onPress={() => openDebtEditor(debt)}>
                            <View style={styles.debtCardBody}>
                              <Text style={styles.debtName}>{debt.name}</Text>
                              <Text style={styles.debtSub}>{String(debt.type).replace("_", " ")}</Text>
                              <Text style={styles.debtSub}>Current balance: {cur}{asMoneyInput(debt.currentBalance) || "0"}</Text>
                              {debt.type === "credit_card" ? (
                                <Text style={styles.debtSub}>Credit limit: {cur}{asMoneyInput(debt.creditLimit) || "0"}</Text>
                              ) : null}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={T.textDim} />
                          </Pressable>
                        ))}
                      </View>
                    ))
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
                <Text style={styles.muted}>These preferences are managed on this device.</Text>
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

      <Modal transparent visible={detailsSheetOpen} animationType="slide" onRequestClose={() => setDetailsSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailsSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit details</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput value={profile?.username ?? authUsername ?? ""} editable={false} style={styles.inputDisabled} />
            <Text style={styles.label}>Email</Text>
            <TextInput value={emailDraft} onChangeText={setEmailDraft} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setDetailsSheetOpen(false)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveDetails} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={budgetFieldSheet !== null} animationType="slide" onRequestClose={() => setBudgetFieldSheet(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBudgetFieldSheet(null)} />
          <View style={styles.sheet}>
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
              <Pressable style={styles.outlineBtnWide} onPress={() => setBudgetFieldSheet(null)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveBudgetField} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={savingsSheetField !== null} animationType="slide" onRequestClose={() => setSavingsSheetField(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSavingsSheetField(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit {savingsSheetField ?? ""} balance</Text>
            <Text style={styles.label}>Amount</Text>
            <TextInput value={savingsValueDraft} onChangeText={setSavingsValueDraft} style={styles.input} keyboardType="decimal-pad" />
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setSavingsSheetField(null)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveSavingsField} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={!!editDebtTarget} animationType="slide" onRequestClose={() => setEditDebtTarget(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditDebtTarget(null)} />
          <View style={styles.sheet}>
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
            <Text style={styles.label}>Current balance</Text>
            <TextInput value={editDebtBalance} onChangeText={setEditDebtBalance} style={styles.input} keyboardType="decimal-pad" />
            {editDebtType === "credit_card" ? (
              <>
                <Text style={styles.label}>Credit limit</Text>
                <TextInput value={editDebtLimit} onChangeText={setEditDebtLimit} style={styles.input} keyboardType="decimal-pad" />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setEditDebtTarget(null)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={saveDebtEdit} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={localeSheetOpen} animationType="slide" onRequestClose={() => setLocaleSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLocaleSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit locale</Text>
            <Text style={styles.label}>Country code</Text>
            <TextInput value={countryDraft} onChangeText={(v) => setCountryDraft(v.toUpperCase())} style={styles.input} autoCapitalize="characters" maxLength={3} />
            <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setLocaleSheetOpen(false)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={() => { void saveCountry(); }} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={addDebtSheetOpen} animationType="slide" onRequestClose={() => setAddDebtSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddDebtSheetOpen(false)} />
          <View style={styles.sheet}>
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
            <Text style={styles.label}>Current balance</Text>
            <TextInput value={addDebtBalance} onChangeText={setAddDebtBalance} style={styles.input} keyboardType="decimal-pad" />
            {addDebtType === "credit_card" ? (
              <>
                <Text style={styles.label}>Credit limit</Text>
                <TextInput value={addDebtLimit} onChangeText={setAddDebtLimit} style={styles.input} keyboardType="decimal-pad" />
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setAddDebtSheetOpen(false)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={addDebt} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Add"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={createPlanSheetOpen} animationType="slide" onRequestClose={() => setCreatePlanSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreatePlanSheetOpen(false)} />
          <View style={styles.sheet}>
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
            <Text style={styles.label}>Event date (YYYY-MM-DD)</Text>
            <TextInput value={newPlanEventDate} onChangeText={setNewPlanEventDate} style={styles.input} autoCapitalize="none" />
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={() => setCreatePlanSheetOpen(false)}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={createSubPlan} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Creating…" : "Create"}</Text></Pressable>
            </View>
          </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { flex: 1 },
  headerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    backgroundColor: `${T.red}18`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerLogoutText: { color: T.red, fontSize: 12, fontWeight: "800" },

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
