import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ActivityIndicator, Animated, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./styles";

import { useAppTranslation } from "@/hooks";
import { fmt } from "@/lib/formatting";
import { INVESTMENT_BUCKET_OPTIONS } from "@/lib/constants";
import { parseMoney } from "@/lib/domain/moneyInput";
import { groupSavingsPotsByField } from "@/lib/helpers/settings";
import { getPayPeriodSelectionFromAnchor } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import { s } from "@/components/IncomeMonthScreen/style";
import IncomeSacrificePieChart from "@/components/Income/IncomeSacrificePieChart";
import MoneyInput from "@/components/Shared/MoneyInput";
import NumericInput from "@/components/Shared/NumericInput";
import OverlaySelectInput from "@/components/Shared/OverlaySelectInput";
import type {
  AmountEntryMode,
  GlassEffectModule,
  IncomeMonthSacrificeListProps,
  IncomeSacrificeItemType,
  SacrificePeriod,
  TargetOption,
} from "@/types";
import type { SavingsField } from "@/types/settings";

const ADD_ITEM_TYPES: Array<{ key: IncomeSacrificeItemType; label: string }> = [
  { key: "allowance", label: "Allowance" },
  { key: "savings", label: "Savings" },
  { key: "emergency", label: "Emergency" },
  { key: "investment", label: "Investment" },
  { key: "custom", label: "Custom" },
];

const ADD_NEW_BROKER_VALUE = "__add_new_broker__";

function normalizeMonthValue(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(12, Math.floor(value)));
}

function normalizeYearValue(value: number): number {
  if (!Number.isFinite(value)) return new Date().getFullYear();
  return Math.max(2000, Math.min(2200, Math.floor(value)));
}

function toMoneyNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGoalYear(value: string): number | null | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const year = Math.floor(parsed);
  if (year < 1900 || year > 3000) return undefined;
  return year;
}

function normalizePotRouteName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBrokerValue(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "none";
}

function isManualBrokerSelection(value: string | null | undefined): boolean {
  const normalized = normalizeBrokerValue(value).toLowerCase();
  return normalized === "none" || normalized === ADD_NEW_BROKER_VALUE;
}

function mapFixedFieldToSavingsField(
  fixedField: TargetOption["fixedField"] | undefined,
): SavingsField | null {
  if (fixedField === "monthlySavingsContribution") return "savings";
  if (fixedField === "monthlyEmergencyContribution") return "emergency";
  if (fixedField === "monthlyInvestmentContribution") return "investment";
  return null;
}

type SwipeableHandle = {
  close: () => void;
};

export default function IncomeMonthSacrificeList(props: IncomeMonthSacrificeListProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const defaultSelection = useMemo(() => {
    return getPayPeriodSelectionFromAnchor({
      year: props.year,
      month: props.month,
      payFrequency: props.payFrequency,
    });
  }, [props.month, props.payFrequency, props.year]);
  const [manageScreen, setManageScreen] = useState<null | "chooser" | "detail" | "add-item" | "link">(null);
  const [targetKey, setTargetKey] = useState("monthlySavingsContribution");
  const [amountDraft, setAmountDraft] = useState("");
  const [amountMode, setAmountMode] = useState<AmountEntryMode>("set");
  const [isInlineAmountEditing, setIsInlineAmountEditing] = useState(false);
  const [period, setPeriod] = useState<SacrificePeriod>("this_month");
  const [startMonth, setStartMonth] = useState(() => normalizeMonthValue(defaultSelection.month));
  const [startYear, setStartYear] = useState(() => normalizeYearValue(defaultSelection.year));

  const [newItemType, setNewItemType] = useState<IncomeSacrificeItemType>("custom");
  const [newItemName, setNewItemName] = useState("");
  const [newItemBroker, setNewItemBroker] = useState("");
  const [newBrokerDraft, setNewBrokerDraft] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemGoalTargetAmount, setNewItemGoalTargetAmount] = useState("");
  const [newItemGoalTargetYear, setNewItemGoalTargetYear] = useState("");
  const [addItemReturnScreen, setAddItemReturnScreen] = useState<"chooser" | "detail">("chooser");
  const [addActionSheetOpen, setAddActionSheetOpen] = useState(false);
  const [selectedPotKey, setSelectedPotKey] = useState<string | null>(null);
  const [linkTargetKey, setLinkTargetKey] = useState("");
  const [linkGoalId, setLinkGoalId] = useState<string>("");
  const [editInvestmentRouteKey, setEditInvestmentRouteKey] = useState<string | null>(null);
  const [editInvestmentAmountDraft, setEditInvestmentAmountDraft] = useState("");
  const [editInvestmentBroker, setEditInvestmentBroker] = useState("none");
  const [editInvestmentBrokerManualDraft, setEditInvestmentBrokerManualDraft] = useState("");
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [mainFooterBlurActive, setMainFooterBlurActive] = useState(false);
  const [manageFooterBlurActive, setManageFooterBlurActive] = useState(false);
  const canManage = props.canManage ?? true;
  const chooserIntro = useRef(new Animated.Value(0)).current;
  const detailIntro = useRef(new Animated.Value(0)).current;
  const footerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const investmentSwipeRefs = useRef<Record<string, SwipeableHandle | null>>({});
  const externalAddSheetTokenRef = useRef(0);
  const glassEffectModule = useMemo<GlassEffectModule | null>(() => {
    if (Platform.OS !== "ios") return null;
    try {
      return require("expo-glass-effect") as GlassEffectModule;
    } catch {
      return null;
    }
  }, []);
  const liquidGlassEnabled = useMemo(() => {
    if (!glassEffectModule) return false;
    try {
      const liquidAvailable = glassEffectModule.isLiquidGlassAvailable();
      const apiAvailable = typeof glassEffectModule.isGlassEffectAPIAvailable === "function"
        ? glassEffectModule.isGlassEffectAPIAvailable()
        : true;

      return liquidAvailable && apiAvailable;
    } catch {
      return false;
    }
  }, [glassEffectModule]);
  const GlassView = glassEffectModule?.GlassView;

  useEffect(() => {
    props.onManageFlowActiveChange?.(Boolean(manageScreen));
    return () => {
      props.onManageFlowActiveChange?.(false);
    };
  }, [manageScreen, props]);

  useEffect(() => {
    if (manageScreen !== "chooser") return;

    chooserIntro.setValue(0);
    Animated.spring(chooserIntro, {
      toValue: 1,
      tension: 42,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [chooserIntro, manageScreen]);

  useEffect(() => {
    if (manageScreen !== "detail") return;

    detailIntro.setValue(0);
    Animated.spring(detailIntro, {
      toValue: 1,
      tension: 44,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [detailIntro, manageScreen]);

  useEffect(() => {
    const shouldShowBackdrop = manageScreen ? manageFooterBlurActive : mainFooterBlurActive;

    Animated.timing(footerBackdropOpacity, {
      toValue: shouldShowBackdrop ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [footerBackdropOpacity, mainFooterBlurActive, manageFooterBlurActive, manageScreen]);

  const potRoutesByField = useMemo(() => {
    const potsByField = groupSavingsPotsByField(props.savingsPots ?? []);
    const customItems = props.sacrifice?.customItems ?? [];
    const customItemById = new Map(customItems.map((item) => [item.id, item] as const));

    const buildRoutes = (field: SavingsField) => potsByField[field].map((pot) => {
      const matchedById = pot.allocationId ? customItemById.get(pot.allocationId) : undefined;
      const allowNameFallback = field !== "investment";
      const normalizedPotName = normalizePotRouteName(pot.name);
      const matchedByName = matchedById || !allowNameFallback || !normalizedPotName
        ? undefined
        : (() => {
          const matches = customItems.filter((item) => normalizePotRouteName(item.name) === normalizedPotName);
          return matches.length === 1 ? matches[0] : undefined;
        })();
      const matchedItem = matchedById ?? matchedByName;
      const currentAmount = Number(pot.amount ?? 0);
      const resolvedAmount = field === "investment"
        ? currentAmount
        : Number(matchedItem?.amount ?? currentAmount);

      return {
        routeKey: pot.id,
        allocationId: pot.allocationId ?? null,
        matchedAllocationId: matchedItem?.id ?? null,
        name: pot.name,
        amount: resolvedAmount,
        currentAmount,
        broker: String(pot.broker ?? "none"),
      };
    });

    return {
      savings: buildRoutes("savings"),
      emergency: buildRoutes("emergency"),
      investment: buildRoutes("investment"),
    };
  }, [props.sacrifice?.customItems, props.savingsPots]);

  const potBackedAllocationIds = useMemo(() => new Set([
    ...potRoutesByField.savings.map((route) => route.matchedAllocationId).filter(Boolean),
    ...potRoutesByField.emergency.map((route) => route.matchedAllocationId).filter(Boolean),
    ...potRoutesByField.investment.map((route) => route.matchedAllocationId).filter(Boolean),
  ]), [potRoutesByField.emergency, potRoutesByField.investment, potRoutesByField.savings]);

  const investmentBrokerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = ["none"];

    for (const pot of props.savingsPots ?? []) {
      if (pot.field !== "investment") continue;
      const broker = normalizeBrokerValue(String(pot.broker ?? "none"));
      const normalized = broker.toLowerCase();
      if (normalized === "none" || seen.has(normalized)) continue;
      seen.add(normalized);
      options.push(broker);
    }

    return options;
  }, [props.savingsPots]);

  const defaultInvestmentBroker = useMemo(
    () => investmentBrokerOptions.find((broker) => broker.toLowerCase() !== "none") ?? "none",
    [investmentBrokerOptions],
  );

  const investmentBrokerDropdownOptions = useMemo(
    () => {
      const existing = investmentBrokerOptions
        .filter((broker) => broker.toLowerCase() !== "none")
        .map((broker) => ({ value: broker, label: broker }));

      return [
        { value: "none", label: "none" },
        ...existing,
        { value: ADD_NEW_BROKER_VALUE, label: "+ Add new broker" },
      ];
    },
    [investmentBrokerOptions],
  );

  useEffect(() => {
    if (newItemType !== "investment") return;

    setNewItemBroker((current) => (current.trim() ? current : defaultInvestmentBroker));
  }, [defaultInvestmentBroker, newItemType]);

  const getPotRouteTotalForField = useCallback((field: SavingsField) => {
    return potRoutesByField[field].reduce((sum, route) => sum + Number(route.amount ?? 0), 0);
  }, [potRoutesByField]);

  const targets = useMemo<TargetOption[]>(() => {
    const fixed = props.sacrifice?.fixed;
    const rows: TargetOption[] = [
      { key: "monthlyAllowance", label: `Allowance (${fmt(Number(fixed?.monthlyAllowance ?? 0), props.currency)})`, kind: "fixed", fixedField: "monthlyAllowance" },
      { key: "monthlySavingsContribution", label: `Savings (${fmt(Number(fixed?.monthlySavingsContribution ?? 0) + getPotRouteTotalForField("savings"), props.currency)})`, kind: "fixed", fixedField: "monthlySavingsContribution" },
      { key: "monthlyEmergencyContribution", label: `Emergency (${fmt(Number(fixed?.monthlyEmergencyContribution ?? 0) + getPotRouteTotalForField("emergency"), props.currency)})`, kind: "fixed", fixedField: "monthlyEmergencyContribution" },
      { key: "monthlyInvestmentContribution", label: `Investments (${fmt(Number(fixed?.monthlyInvestmentContribution ?? 0) + getPotRouteTotalForField("investment"), props.currency)})`, kind: "fixed", fixedField: "monthlyInvestmentContribution" },
    ];

    const customRows = (props.sacrifice?.customItems ?? [])
      .filter((item) => !potBackedAllocationIds.has(item.id) && !item.isOverride && Number(item.amount ?? 0) > 0)
      .map((item) => ({
        key: `custom:${item.id}`,
        label: `${item.name} (${fmt(Number(item.amount ?? 0), props.currency)})`,
        kind: "custom" as const,
        customAllocationId: item.id,
      }));

    return [...rows, ...customRows];
  }, [getPotRouteTotalForField, potBackedAllocationIds, props.currency, props.sacrifice?.customItems, props.sacrifice?.fixed]);

  const pieSlices = useMemo(() => {
    if (!props.sacrifice) return [];
    const uncategorizedCustomTotal = (props.sacrifice.customItems ?? [])
      .filter((item) => !potBackedAllocationIds.has(item.id) && !item.isOverride)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const baseSlices = [
      { key: "allowance", label: "Allowance", value: Number(props.sacrifice.fixed.monthlyAllowance ?? 0), color: T.orange },
      { key: "savings", label: "Savings", value: Number(props.sacrifice.fixed.monthlySavingsContribution ?? 0) + getPotRouteTotalForField("savings"), color: T.accent },
      { key: "emergency", label: "Emergency", value: Number(props.sacrifice.fixed.monthlyEmergencyContribution ?? 0) + getPotRouteTotalForField("emergency"), color: T.text },
      { key: "investments", label: "Investments", value: Number(props.sacrifice.fixed.monthlyInvestmentContribution ?? 0) + getPotRouteTotalForField("investment"), color: T.green },
    ];

    if (uncategorizedCustomTotal <= 0) {
      return baseSlices;
    }

    return [
      ...baseSlices,
      { key: "custom", label: "Custom", value: uncategorizedCustomTotal, color: T.red },
    ];
  }, [getPotRouteTotalForField, potBackedAllocationIds, props.sacrifice]);

  const toLinkedTargetKey = (key: string) => (key.startsWith("custom:") ? key : `fixed:${key}`);

  const linkByTarget = useMemo(() => {
    const rows = new Map<string, { goalId: string; goalTitle: string }>();
    for (const link of props.sacrifice?.goalLinks ?? []) {
      rows.set(link.targetKey, { goalId: link.goalId, goalTitle: link.goalTitle });
    }
    return rows;
  }, [props.sacrifice?.goalLinks]);

  const goalsById = useMemo(() => {
    const rows = new Map<string, { title: string; currentAmount: number; targetAmount: number }>();
    for (const goal of props.sacrifice?.goals ?? []) {
      rows.set(goal.id, {
        title: goal.title,
        currentAmount: toMoneyNumber(goal.currentAmount),
        targetAmount: toMoneyNumber(goal.targetAmount),
      });
    }
    return rows;
  }, [props.sacrifice?.goals]);

  const getCurrentAmountForTarget = useCallback((key: string) => {
    if (!props.sacrifice) return 0;

    if (key === "monthlyAllowance") {
      return Number(props.sacrifice.fixed.monthlyAllowance ?? 0);
    }
    if (key === "monthlySavingsContribution") {
      return Number(props.sacrifice.fixed.monthlySavingsContribution ?? 0) + getPotRouteTotalForField("savings");
    }
    if (key === "monthlyEmergencyContribution") {
      return Number(props.sacrifice.fixed.monthlyEmergencyContribution ?? 0) + getPotRouteTotalForField("emergency");
    }
    if (key === "monthlyInvestmentContribution") {
      return Number(props.sacrifice.fixed.monthlyInvestmentContribution ?? 0) + getPotRouteTotalForField("investment");
    }
    if (key.startsWith("custom:")) {
      const customId = key.slice("custom:".length);
      const item = props.sacrifice.customItems.find((row) => row.id === customId);
      return Number(item?.amount ?? 0);
    }

    return 0;
  }, [getPotRouteTotalForField, props.sacrifice]);

  const getDisplayTotalForTarget = useCallback((key: string) => {
    const currentAmount = getCurrentAmountForTarget(key);
    if (!props.sacrifice) return currentAmount;

    if (key === "monthlySavingsContribution") {
      return currentAmount + Number(props.sacrifice.baseBalances?.savings ?? 0);
    }
    if (key === "monthlyEmergencyContribution") {
      return currentAmount + Number(props.sacrifice.baseBalances?.emergency ?? 0);
    }
    if (key === "monthlyInvestmentContribution") {
      return currentAmount + Number(props.sacrifice.baseBalances?.investment ?? 0);
    }

    return currentAmount;
  }, [getCurrentAmountForTarget, props.sacrifice]);

  const getTargetTitle = useCallback((target: TargetOption) => {
    if (target.key === "monthlyAllowance") return "Allowance";
    if (target.key === "monthlySavingsContribution") return "Savings";
    if (target.key === "monthlyEmergencyContribution") return "Emergency";
    if (target.key === "monthlyInvestmentContribution") return "Investments";

    return target.label.replace(/\s+\([^)]*\)$/, "");
  }, []);

  const targetCards = useMemo(() => {
    return targets.map((target) => ({
      linkedGoal: (() => {
        const link = linkByTarget.get(toLinkedTargetKey(target.key));
        if (!link) return null;
        const goal = goalsById.get(link.goalId);
        if (!goal || goal.targetAmount <= 0) {
          return {
            title: link.goalTitle,
            currentAmount: goal?.currentAmount ?? 0,
            targetAmount: goal?.targetAmount ?? 0,
            progressPct: 0,
          };
        }

        return {
          title: goal.title,
          currentAmount: goal.currentAmount,
          targetAmount: goal.targetAmount,
          progressPct: Math.max(0, Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)),
        };
      })(),
      key: target.key,
      title: getTargetTitle(target),
      totalAmount: getDisplayTotalForTarget(target.key),
      dueAmount: getCurrentAmountForTarget(target.key),
      section: target.kind === "custom" ? "custom" : "core",
      meta: target.kind === "custom" ? "Custom sacrifice" : "Sacrifice total",
      iconName:
        target.key === "monthlyAllowance"
          ? "wallet-outline"
          : target.key === "monthlySavingsContribution"
            ? "save-outline"
            : target.key === "monthlyEmergencyContribution"
              ? "shield-outline"
              : target.key === "monthlyInvestmentContribution"
                ? "trending-up-outline"
                : "layers-outline",
      iconTone:
        target.key === "monthlyAllowance"
          ? T.orange
          : target.key === "monthlySavingsContribution"
            ? T.accent
            : target.key === "monthlyEmergencyContribution"
              ? T.text
              : target.key === "monthlyInvestmentContribution"
                ? T.green
                : T.red,
    }));
  }, [getCurrentAmountForTarget, getDisplayTotalForTarget, getTargetTitle, goalsById, linkByTarget, targets]);

  const coreTargetCards = useMemo(() => targetCards.filter((target) => target.section === "core"), [targetCards]);
  const customTargetCards = useMemo(() => targetCards.filter((target) => target.section === "custom"), [targetCards]);
  const chooserPeriodTotal = useMemo(() => Number(props.sacrifice?.totalSacrifice ?? 0), [props.sacrifice?.totalSacrifice]);
  const chooserOverallTotal = useMemo(
    () => targetCards.reduce((sum, target) => sum + Number(target.totalAmount ?? 0), 0),
    [targetCards],
  );
  const chooserTargetCount = targetCards.length;
  const chooserHeroTranslateY = useMemo(() => chooserIntro.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }), [chooserIntro]);
  const chooserCardsTranslateY = useMemo(() => chooserIntro.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }), [chooserIntro]);
  const chooserCardsScale = useMemo(() => chooserIntro.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }), [chooserIntro]);
  const detailHeroTranslateY = useMemo(() => detailIntro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }), [detailIntro]);
  const detailContentTranslateY = useMemo(() => detailIntro.interpolate({ inputRange: [0, 1], outputRange: [38, 0] }), [detailIntro]);

  const selectedTarget = useMemo(() => {
    return targets.find((target) => target.key === targetKey) ?? null;
  }, [targetKey, targets]);

  const selectedTargetCard = useMemo(() => {
    return targetCards.find((target) => target.key === targetKey) ?? null;
  }, [targetCards, targetKey]);

  const selectedTargetTitle = useMemo(() => {
    return selectedTarget ? getTargetTitle(selectedTarget) : "Edit sacrifice";
  }, [getTargetTitle, selectedTarget]);

  const selectedTargetSavingsField = useMemo(
    () => mapFixedFieldToSavingsField(selectedTarget?.fixedField),
    [selectedTarget?.fixedField],
  );
  const selectedPotRoutes = useMemo(() => {
    if (!selectedTargetSavingsField) return [];
    return potRoutesByField[selectedTargetSavingsField];
  }, [potRoutesByField, selectedTargetSavingsField]);
  const selectedPotRoute = useMemo(
    () => selectedPotRoutes.find((route) => route.routeKey === selectedPotKey) ?? selectedPotRoutes[0] ?? null,
    [selectedPotKey, selectedPotRoutes],
  );
  const editingInvestmentRoute = useMemo(
    () => selectedPotRoutes.find((route) => route.routeKey === editInvestmentRouteKey) ?? null,
    [editInvestmentRouteKey, selectedPotRoutes],
  );

  useEffect(() => {
    if (selectedPotRoutes.length === 0) {
      setSelectedPotKey(null);
      return;
    }

    setSelectedPotKey((current) => {
      if (current && selectedPotRoutes.some((route) => route.routeKey === current)) return current;
      return selectedPotRoutes[0]!.routeKey;
    });
  }, [selectedPotRoutes]);

  const serverSacrificeTips = useMemo(() => {
    return (props.sacrifice?.tips ?? []).filter((tip) => String(tip?.title ?? "").trim() && String(tip?.detail ?? "").trim());
  }, [props.sacrifice?.tips]);

  const fallbackSacrificeTips = useMemo(() => {
    if (!props.sacrifice) return [];

    const allowance = Number(props.sacrifice.fixed.monthlyAllowance ?? 0);
    const savings = Number(props.sacrifice.fixed.monthlySavingsContribution ?? 0);
    const emergency = Number(props.sacrifice.fixed.monthlyEmergencyContribution ?? 0);
    const investments = Number(props.sacrifice.fixed.monthlyInvestmentContribution ?? 0);
    const customTotal = Number(props.sacrifice.customTotal ?? 0);
    const total = Number(props.sacrifice.totalSacrifice ?? 0);
    const customCount = props.sacrifice.customItems.length;
    const tips: Array<{ title: string; detail: string; priority?: number }> = [];

    if (total <= 0) {
      tips.push({
        title: t("income.sacrifice.tip.startTitle"),
        detail: t("income.sacrifice.tip.startDetail"),
        priority: 90,
      });
    }

    if (allowance > 0 && savings + emergency + investments + customTotal === 0) {
      tips.push({
        title: t("income.sacrifice.tip.allowanceTitle"),
        detail: t("income.sacrifice.tip.allowanceDetail"),
        priority: 85,
      });
    }

    if (emergency <= 0 && total > 0) {
      tips.push({
        title: t("income.sacrifice.tip.emergencyTitle"),
        detail: t("income.sacrifice.tip.emergencyDetail"),
        priority: 80,
      });
    }

    if (customCount > 0) {
      tips.push({
        title: t("income.sacrifice.tip.customTitle"),
        detail: t("income.sacrifice.tip.customDetail"),
        priority: 65,
      });
    }

    if (!tips.length) {
      tips.push({
        title: t("income.sacrifice.tip.balancedTitle"),
        detail: t("income.sacrifice.tip.balancedDetail"),
        priority: 60,
      });
    }

    return tips;
  }, [props.sacrifice, t]);

  const sacrificeTips = serverSacrificeTips.length ? serverSacrificeTips : fallbackSacrificeTips;

  useEffect(() => {
    setActiveTipIndex(0);
  }, [sacrificeTips]);

  useEffect(() => {
    if (sacrificeTips.length <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveTipIndex((current) => (current + 1) % sacrificeTips.length);
    }, 15000);

    return () => clearInterval(timer);
  }, [sacrificeTips.length]);

  const activeSacrificeTip = sacrificeTips.length ? sacrificeTips[activeTipIndex % sacrificeTips.length] : null;

  const openLinkScreen = (targetKeyOverride?: string) => {
    if (!canManage) return;
    const initialTarget = targetKeyOverride ?? targets[0]?.key ?? "monthlySavingsContribution";
    const firstTargetKey = toLinkedTargetKey(initialTarget);
    const existingGoalId = linkByTarget.get(firstTargetKey)?.goalId ?? "";
    setLinkTargetKey(initialTarget);
    setLinkGoalId(existingGoalId);
    setManageScreen("link");
  };

  const _openSelectedTargetLinkScreen = () => {
    openLinkScreen(targetKey);
  };

  const selectLinkTarget = (key: string) => {
    setLinkTargetKey(key);
    const linkedKey = toLinkedTargetKey(key);
    const existingGoalId = linkByTarget.get(linkedKey)?.goalId ?? "";
    setLinkGoalId(existingGoalId);
  };

  const submitGoalLink = async () => {
    const linkedKey = toLinkedTargetKey(linkTargetKey);
    await props.onSaveGoalLink({
      targetKey: linkedKey,
      goalId: linkGoalId || null,
    });
    setManageScreen("detail");
  };

  const selectedCurrentAmount = useMemo(() => getCurrentAmountForTarget(targetKey), [getCurrentAmountForTarget, targetKey]);
  const selectedDisplayTotal = useMemo(() => getDisplayTotalForTarget(targetKey), [getDisplayTotalForTarget, targetKey]);
  const editableCurrentAmount = useMemo(
    () => selectedPotRoute?.amount ?? selectedCurrentAmount,
    [selectedCurrentAmount, selectedPotRoute?.amount],
  );
  const parsedInlineAmount = useMemo(() => parseMoney(amountDraft), [amountDraft]);
  const previewCurrentAmount = isInlineAmountEditing && parsedInlineAmount != null ? parsedInlineAmount : editableCurrentAmount;
  const previewDisplayTotal = useMemo(() => {
    if (!(isInlineAmountEditing && parsedInlineAmount != null)) return selectedDisplayTotal;
    return Math.max(0, selectedDisplayTotal - editableCurrentAmount + parsedInlineAmount);
  }, [editableCurrentAmount, isInlineAmountEditing, parsedInlineAmount, selectedDisplayTotal]);

  const renderFooterButton = useCallback(({
    label,
    iconName,
    accessibilityLabel,
    onPress,
    disabled,
    accent,
  }: {
    label: string;
    iconName?: React.ComponentProps<typeof Ionicons>["name"];
    accessibilityLabel?: string;
    onPress?: (() => void) | null;
    disabled?: boolean;
    accent?: boolean;
  }) => {
    const isDisabled = Boolean(disabled || !onPress);
    const iconOnly = Boolean(iconName && !label);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.mainFooterBtn,
          iconOnly && styles.mainFooterBtnIconOnly,
          accent && styles.mainFooterBtnAccent,
          pressed && styles.mainFooterBtnPressed,
          isDisabled && styles.disabled,
        ]}
        onPress={onPress ?? undefined}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        <BlurView
          intensity={accent ? 42 : 34}
          tint={accent ? "dark" : "systemChromeMaterialLight"}
          style={[styles.mainFooterBtnBlur, iconOnly && styles.mainFooterBtnBlurIconOnly, accent && styles.mainFooterBtnBlurAccent]}
        >
          {liquidGlassEnabled && GlassView ? (
            <GlassView
              pointerEvents="none"
              glassEffectStyle={{
                style: "regular",
                animate: true,
                animationDuration: 0.2,
              }}
              tintColor="rgba(255,255,255,0)"
              style={styles.mainFooterBtnGlass}
            />
          ) : null}
          <View style={[styles.mainFooterBtnInner, accent && styles.mainFooterBtnInnerAccent]} />
          {iconName ? (
            <Ionicons
              name={iconName}
              size={18}
              color={accent ? T.text : "#f4f5fb"}
            />
          ) : null}
          {label ? <Text style={[styles.mainFooterBtnText, accent && styles.mainFooterBtnTextAccent]}>{label}</Text> : null}
        </BlurView>
      </Pressable>
    );
  }, [GlassView, liquidGlassEnabled]);

  const handleMainScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextVisible = event.nativeEvent.contentOffset.y > 8;
    setMainFooterBlurActive((current) => (current === nextVisible ? current : nextVisible));
  }, []);

  const handleManageScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextVisible = event.nativeEvent.contentOffset.y > 8;
    setManageFooterBlurActive((current) => (current === nextVisible ? current : nextVisible));
  }, []);

  const openManageFlow = () => {
    if (!canManage) return;
    const initialTargetKey = targets[0]?.key ?? "monthlySavingsContribution";
    const currentAmount = getCurrentAmountForTarget(initialTargetKey);
    setTargetKey(initialTargetKey);
    setAmountMode("set");
    setAmountDraft(currentAmount.toFixed(2));
    setStartMonth(normalizeMonthValue(defaultSelection.month));
    setStartYear(normalizeYearValue(defaultSelection.year));
    setPeriod("this_month");
    setManageScreen("chooser");
  };

  const openTargetEditor = (key: string) => {
    setTargetKey(key);
    const target = targets.find((row) => row.key === key) ?? null;
    const savingsField = mapFixedFieldToSavingsField(target?.fixedField);
    const currentAmount = savingsField && potRoutesByField[savingsField].length > 0
      ? Number(potRoutesByField[savingsField][0]!.amount ?? 0)
      : getCurrentAmountForTarget(key);
    setAmountMode("set");
    setAmountDraft(currentAmount.toFixed(2));
    setIsInlineAmountEditing(false);
    setManageScreen("detail");
  };

  const handleOverviewSlicePress = (sliceKey: string) => {
    if (!canManage) return;

    if (sliceKey === "allowance") {
      openTargetEditor("monthlyAllowance");
      return;
    }

    if (sliceKey === "savings") {
      openTargetEditor("monthlySavingsContribution");
      return;
    }

    if (sliceKey === "emergency") {
      openTargetEditor("monthlyEmergencyContribution");
      return;
    }

    if (sliceKey === "investments") {
      openTargetEditor("monthlyInvestmentContribution");
      return;
    }

    if (sliceKey === "custom" && customTargetCards.length === 1) {
      openTargetEditor(customTargetCards[0]!.key);
      return;
    }

    openManageFlow();
  };

  const goBackFromManageScreen = () => {
    setIsInlineAmountEditing(false);
    if (manageScreen === "detail") {
      setManageScreen("chooser");
      return;
    }
    if (manageScreen === "add-item") {
      setManageScreen(addItemReturnScreen === "detail" ? "detail" : "chooser");
      return;
    }
    if (manageScreen === "link") {
      setManageScreen("detail");
      return;
    }
    setManageScreen(null);
  };

  const submitAmountSheet = async (options?: {
    closeAfterSave?: boolean;
    routeKeyOverride?: string;
    amountOverride?: number;
    skipSavingIndicator?: boolean;
  }) => {
    const selected = targets.find((target) => target.key === targetKey);
    const enteredAmount = options?.amountOverride ?? parseMoney(amountDraft);
    const normalizedStartMonth = normalizeMonthValue(startMonth);
    const normalizedStartYear = normalizeYearValue(startYear);
    const activeRoute = options?.routeKeyOverride
      ? (selectedPotRoutes.find((route) => route.routeKey === options.routeKeyOverride) ?? selectedPotRoute)
      : selectedPotRoute;

    if (!selected) {
      Alert.alert("Select sacrifice", "Pick a sacrifice target to update.");
      return;
    }

    if (enteredAmount == null) {
      Alert.alert("Enter amount", "Enter a valid amount before saving.");
      return;
    }

    if (normalizedStartMonth !== startMonth) {
      setStartMonth(normalizedStartMonth);
    }

    if (normalizedStartYear !== startYear) {
      setStartYear(normalizedStartYear);
    }

    const finalAmount = amountMode === "adjust" ? editableCurrentAmount + enteredAmount : enteredAmount;
    if (finalAmount < 0) {
      Alert.alert("Invalid amount", "Adjustment would make this sacrifice negative.");
      return;
    }

    const selectedRouteAllocationId = activeRoute?.allocationId ?? activeRoute?.matchedAllocationId ?? null;
    const routedAllocationId = selected.kind === "fixed" && selectedPotRoutes.length > 0
      ? (selectedRouteAllocationId ?? await props.onEnsurePotAllocationRoute?.({
        field: selectedTargetSavingsField as SavingsField,
        potId: activeRoute?.routeKey ?? "",
        potName: activeRoute?.name ?? "",
      }) ?? null)
      : null;

    if (selected.kind === "fixed" && selectedPotRoutes.length > 0 && !routedAllocationId) {
      Alert.alert("Choose a pot", "Pick the pot that should receive this sacrifice amount.");
      return;
    }

    await props.onApplySacrificeAmount({
      targetType: routedAllocationId ? "custom" : selected.kind,
      fixedField: routedAllocationId ? undefined : selected.fixedField,
      customAllocationId: routedAllocationId ?? selected.customAllocationId,
      potId: activeRoute?.routeKey,
      amount: finalAmount,
      startMonth: normalizedStartMonth,
      startYear: normalizedStartYear,
      period,
      skipSavingIndicator: options?.skipSavingIndicator,
    });
    setIsInlineAmountEditing(false);
    if (options?.closeAfterSave !== false) {
      setManageScreen(null);
    }
  };

  const submitAddItemSheet = async () => {
    const amount = parseMoney(newItemAmount);
    const goalTargetAmount = parseMoney(newItemGoalTargetAmount);
    const goalTargetYear = parseGoalYear(newItemGoalTargetYear);
    const trimmedBroker = normalizeBrokerValue(newItemBroker);
    const normalizedBrokerSelection = trimmedBroker.toLowerCase();
    const manualBroker = newBrokerDraft.trim();
    const resolvedBroker = newItemType === "investment"
      ? (isManualBrokerSelection(trimmedBroker) ? (manualBroker || "none") : trimmedBroker)
      : "none";

    if (amount == null || amount < 0) {
      Alert.alert("Enter amount", "Enter a valid amount to contribute each pay period.");
      return;
    }

    if (newItemType === "custom") {
      if (!newItemName.trim()) {
        Alert.alert("Name required", "Enter a custom sacrifice target name.");
        return;
      }
      if (amount <= 0) {
        Alert.alert("Amount required", "Enter the amount you want to pay toward this custom sacrifice.");
        return;
      }
      if (goalTargetAmount == null || goalTargetAmount <= 0) {
        Alert.alert("Target required", "Enter the goal target amount for this custom sacrifice.");
        return;
      }
      if (goalTargetYear == null) {
        Alert.alert("Target year required", "Enter the year you want to reach this goal.");
        return;
      }
      if (goalTargetYear === undefined) {
        Alert.alert("Invalid target year", "Enter a valid target year.");
        return;
      }
    }

    if (newItemType === "investment" && !newItemName.trim()) {
      Alert.alert("Bucket required", "Choose an investment bucket or type a custom name like Broker.");
      return;
    }

    if (newItemType === "investment" && normalizedBrokerSelection === ADD_NEW_BROKER_VALUE && !manualBroker) {
      Alert.alert("Broker required", "Type the new broker name before creating this investment item.");
      return;
    }

    try {
      await props.onCreateItem({
        type: newItemType,
        name: newItemName,
        amount,
        broker: newItemType === "investment" ? resolvedBroker : undefined,
        goalTargetAmount: newItemType === "custom" ? (goalTargetAmount ?? undefined) : undefined,
        goalTargetYear: newItemType === "custom" ? (goalTargetYear ?? undefined) : undefined,
      });
    } catch {
      return;
    }

    setNewItemType("custom");
    setNewItemName("");
    setNewItemBroker("");
    setNewBrokerDraft("");
    setNewItemAmount("");
    setNewItemGoalTargetAmount("");
    setNewItemGoalTargetYear("");
    setAddActionSheetOpen(false);
    setManageScreen(addItemReturnScreen === "detail" ? "detail" : "chooser");
  };

  const openAddItemScreen = useCallback(() => {
    setAddActionSheetOpen(false);
    setNewItemType("custom");
    setNewItemName("");
    setNewItemBroker("");
    setNewBrokerDraft("");
    setNewItemAmount("");
    setNewItemGoalTargetAmount("");
    setNewItemGoalTargetYear("");
    setAddItemReturnScreen("chooser");
    setManageScreen("add-item");
  }, []);

  const openAddActionSheet = useCallback(() => {
    openAddItemScreen();
  }, [openAddItemScreen]);

  const openInvestmentAddActionSheet = useCallback(() => {
    setNewItemType("investment");
    setNewItemName("");
    setNewItemBroker(defaultInvestmentBroker);
    setNewBrokerDraft("");
    setNewItemAmount("");
    setNewItemGoalTargetAmount("");
    setNewItemGoalTargetYear("");
    setAddItemReturnScreen("detail");
    setAddActionSheetOpen(true);
  }, [defaultInvestmentBroker]);

  const closeAddActionSheet = useCallback(() => {
    setAddActionSheetOpen(false);
  }, []);

  useEffect(() => {
    const nextToken = Number(props.openAddSheetToken ?? 0);
    if (!Number.isFinite(nextToken) || nextToken <= 0) return;
    if (externalAddSheetTokenRef.current === nextToken) return;

    externalAddSheetTokenRef.current = nextToken;
    if (!canManage) return;

    openAddItemScreen();
  }, [canManage, openAddItemScreen, props.openAddSheetToken]);

  const openInvestmentEditSheet = useCallback((routeKey: string) => {
    const route = selectedPotRoutes.find((entry) => entry.routeKey === routeKey);
    if (!route) return;

    const normalizedBroker = normalizeBrokerValue(route.broker);

    setSelectedPotKey(routeKey);
    setAmountMode("set");
    setAmountDraft(route.amount.toFixed(2));
    setEditInvestmentRouteKey(routeKey);
    setEditInvestmentAmountDraft(route.amount.toFixed(2));
    setEditInvestmentBroker(normalizedBroker);
    setEditInvestmentBrokerManualDraft("");
  }, [selectedPotRoutes]);

  const closeInvestmentEditSheet = useCallback(() => {
    setEditInvestmentRouteKey(null);
    setEditInvestmentAmountDraft("");
    setEditInvestmentBroker("none");
    setEditInvestmentBrokerManualDraft("");
  }, []);

  const saveInvestmentEditSheet = () => {
    if (!editInvestmentRouteKey) return;

    const amount = parseMoney(editInvestmentAmountDraft);
    if (amount == null || amount < 0) {
      Alert.alert("Enter amount", "Enter a valid amount for this investment allocation.");
      return;
    }

    const normalizedBroker = normalizeBrokerValue(editInvestmentBroker);
    const normalizedBrokerSelection = normalizedBroker.toLowerCase();
    const manualBroker = editInvestmentBrokerManualDraft.trim();
    const resolvedBroker = isManualBrokerSelection(normalizedBroker)
      ? (manualBroker || "none")
      : normalizedBroker;

    if (normalizedBrokerSelection === ADD_NEW_BROKER_VALUE && !manualBroker) {
      Alert.alert("Broker required", "Type the new broker name before saving.");
      return;
    }

    const routeKey = editInvestmentRouteKey;
    closeInvestmentEditSheet();

    void (async () => {
      try {
        await submitAmountSheet({
          closeAfterSave: false,
          routeKeyOverride: routeKey,
          amountOverride: amount,
          skipSavingIndicator: true,
        });

        if (props.onUpdateInvestmentPotBroker) {
          await props.onUpdateInvestmentPotBroker({
            potId: routeKey,
            broker: resolvedBroker,
          });
        }
      } catch {
        Alert.alert("Could not save investment", "Please try again.");
      }
    })();
  };

  const isInvestmentQuickAdd = manageScreen === "add-item"
    && addItemReturnScreen === "detail"
    && newItemType === "investment";

  const manageHeaderTitle = manageScreen === "detail"
    ? null
    : manageScreen === "add-item"
      ? (isInvestmentQuickAdd ? "Add investment item" : "Add sacrifice item")
      : manageScreen === "link"
        ? "Link sacrifice to goal"
        : null;

  const renderManageContent = () => {
    if (manageScreen === "detail") {
      const isInvestmentTarget = selectedTarget?.key === "monthlyInvestmentContribution";

      return (
        <>
          <Animated.View
            style={[
              styles.detailHero,
              styles.detailHeroNoCard,
              {
                opacity: detailIntro,
                transform: [{ translateY: detailHeroTranslateY }],
              },
            ]}
          >
            <View style={[styles.detailHeroGlow, styles.detailHeroGlowPrimary]} />
            <View style={[styles.detailHeroGlow, styles.detailHeroGlowSecondary]} />
            <View
              style={[
                styles.detailHeroIcon,
                {
                  backgroundColor: `${selectedTargetCard?.iconTone ?? T.accent}18`,
                  borderColor: `${selectedTargetCard?.iconTone ?? T.accent}3d`,
                },
              ]}
            >
              <Ionicons name={(selectedTargetCard?.iconName as any) ?? "wallet-outline"} size={26} color={selectedTargetCard?.iconTone ?? T.accent} />
            </View>
            <Text style={styles.detailHeroTitle}>{selectedTargetTitle}</Text>
            <Text style={styles.detailHeroAmount}>{fmt(previewDisplayTotal, props.currency)}</Text>
            <Text style={styles.detailHeroMeta}>Overall saved for this sacrifice target.</Text>
            {selectedTarget?.kind === "fixed" ? (
              <View style={styles.detailEditorCard}>
                <Text style={styles.detailEditorLabel}>{selectedPotRoute ? `${selectedPotRoute.name} this pay period` : "Due this pay period"}</Text>
                <Text style={styles.detailEditorValue}>{fmt(previewCurrentAmount, props.currency)}</Text>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            style={{
              opacity: detailIntro,
              transform: [{ translateY: detailContentTranslateY }],
            }}
          >
            {isInvestmentTarget ? (
              <View style={styles.investmentsAddedCard}>
                <View style={styles.investmentsAddedHeader}>
                  <Text style={styles.investmentsAddedTitle}>Investment sacrifices</Text>
                </View>

                {selectedPotRoutes.length <= 0 ? (
                  <Text style={styles.investmentsAddedEmptyText}>No investments sacrifice added</Text>
                ) : (
                  <View style={styles.investmentsAddedList}>
                    {selectedPotRoutes.map((route) => {
                      const active = route.routeKey === selectedPotRoute?.routeKey;
                      const allocationId = route.matchedAllocationId ?? route.allocationId;
                      const brokerLabel = route.broker.trim() && route.broker.trim().toLowerCase() !== "none"
                        ? route.broker.trim()
                        : "none";
                      const startInvestmentSheetEdit = () => {
                        openInvestmentEditSheet(route.routeKey);
                      };
                      const closeSwipe = () => {
                        investmentSwipeRefs.current[route.routeKey]?.close();
                      };

                      return (
                        <Swipeable
                          key={route.routeKey}
                          overshootLeft={false}
                          renderLeftActions={() => (
                            <View style={styles.investmentsSwipeActionsWrap}>
                              <Pressable
                                style={[styles.investmentsSwipeActionCircle, styles.investmentsSwipeActionCircleEdit]}
                                onPress={() => {
                                  closeSwipe();
                                  startInvestmentSheetEdit();
                                }}
                              >
                                <Ionicons name="create-outline" size={16} color="#ffffff" />
                              </Pressable>
                              <Pressable
                                style={[styles.investmentsSwipeActionCircle, styles.investmentsSwipeActionCircleDelete]}
                                onPress={() => {
                                  closeSwipe();
                                  if (!allocationId) return;
                                  Alert.alert(
                                    "Delete investment",
                                    `Remove ${route.name} from investment sacrifices?`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Delete",
                                        style: "destructive",
                                        onPress: () => {
                                          if (selectedPotKey === route.routeKey) {
                                            setIsInlineAmountEditing(false);
                                          }
                                          void props.onDeleteCustom(allocationId);
                                        },
                                      },
                                    ],
                                  );
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                              </Pressable>
                            </View>
                          )}
                          ref={(instance) => {
                            investmentSwipeRefs.current[route.routeKey] = (instance as SwipeableHandle | null);
                          }}
                        >
                          <Pressable
                            style={[styles.investmentsAddedItemCard, active && styles.investmentsAddedItemCardActive]}
                            onPress={startInvestmentSheetEdit}
                          >
                            <View style={styles.investmentsAddedItemCopy}>
                              <Text style={styles.investmentsAddedItemTitle}>{route.name}</Text>
                              <Text style={styles.investmentsAddedItemMeta}>Broker: {brokerLabel}</Text>
                            </View>
                            <Text style={styles.investmentsAddedItemAmount}>{fmt(route.amount, props.currency)}</Text>
                          </Pressable>
                        </Swipeable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </Animated.View>
        </>
      );
    }

    if (manageScreen === "add-item") {
      return (
        <>
          {!isInvestmentQuickAdd ? (
            <View style={styles.detailSectionCard}>
              <View style={styles.detailSectionHeader}>
                <Text style={styles.detailSectionTitle}>Add a sacrifice target</Text>
                {newItemType === "custom" ? (
                  <View style={styles.detailSectionPill}>
                    <Text style={styles.detailSectionPillText}>Shows in Goals</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.detailSectionHelp}>
                {newItemType === "custom"
                  ? "Custom sacrifices create a linked goal so they stay in sync with the Goals screen."
                  : "Use this to add or reshape one of the built-in sacrifice buckets for this period."}
              </Text>
            </View>
          ) : null}

          {!isInvestmentQuickAdd ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionSubHeaderRow}>
                <Text style={styles.cardTitle}>Sacrifice type</Text>
                <Text style={styles.inlineMetaText}>{newItemType === "custom" ? "Goal-backed" : "Built-in"}</Text>
              </View>
              <View style={styles.pillWrap}>
                {ADD_ITEM_TYPES.map((type) => (
                  <Pressable key={type.key} style={[styles.pill, type.key === newItemType && styles.pillActive]} onPress={() => setNewItemType(type.key)}>
                    <Text style={[styles.pillText, type.key === newItemType && styles.pillTextActive]}>{type.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>
              {newItemType === "custom"
                ? "Goal details"
                : newItemType === "investment"
                  ? "Investment details"
                  : "Item details"}
            </Text>
            <Text style={styles.cardSub}>
              {newItemType === "custom"
                ? "This follows the same structure as adding a goal: name it, set the pay-period amount, and choose the target."
                : newItemType === "investment"
                  ? "Choose the investment bucket you want to fund for this period, or enter your own label."
                  : "Give the item a clear label and the amount you want saved for this period."}
            </Text>

            <Text style={styles.fieldLabel}>
              {newItemType === "custom"
                ? "Goal name"
                : newItemType === "investment"
                  ? "Investment bucket"
                  : "Name"}
            </Text>
            {newItemType === "investment" ? (
              <View style={styles.pillWrap}>
                {INVESTMENT_BUCKET_OPTIONS.map((option) => {
                  const active = newItemName.trim().toLowerCase() === option.toLowerCase();

                  return (
                    <Pressable
                      key={option}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setNewItemName(option)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={newItemType === "custom"
                ? "What are you saving for?"
                : newItemType === "investment"
                  ? "Stocks, Crypto, Commodities, or type Broker"
                  : "Optional custom label"}
              placeholderTextColor={T.textMuted}
            />
            {newItemType === "investment" ? (
              <Text style={styles.fieldHelpText}>The Investments heading stays grouped, but each bucket can be funded separately.</Text>
            ) : null}

            {newItemType === "investment" ? (
              <>
                <Text style={styles.fieldLabel}>Broker</Text>
                <OverlaySelectInput
                  value={normalizeBrokerValue(newItemBroker)}
                  onChange={(next) => {
                    setNewItemBroker(next);
                    if (!isManualBrokerSelection(next)) {
                      setNewBrokerDraft("");
                    }
                  }}
                  options={investmentBrokerDropdownOptions}
                  triggerStyle={styles.input}
                  placeholder="Select broker"
                />

                {isManualBrokerSelection(newItemBroker) ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={newBrokerDraft}
                      onChangeText={setNewBrokerDraft}
                      placeholder="Add broker manually"
                      placeholderTextColor={T.textMuted}
                    />
                    <Text style={styles.fieldHelpText}>If you add a broker here, it will be saved and available in this dropdown next time.</Text>
                  </>
                ) : (
                  <Text style={styles.fieldHelpText}>Pick from brokers saved in Settings or choose + Add new broker.</Text>
                )}
              </>
            ) : null}

            <View style={styles.amountSummaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{newItemType === "custom" ? "Amount each pay period" : "Starting amount"}</Text>
                <MoneyInput
                  currency={props.currency}
                  value={newItemAmount}
                  onChangeValue={setNewItemAmount}
                  placeholder="0.00"
                />
              </View>

              {newItemType === "custom" ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Goal target amount</Text>
                  <MoneyInput
                    currency={props.currency}
                    value={newItemGoalTargetAmount}
                    onChangeValue={setNewItemGoalTargetAmount}
                    placeholder="0.00"
                  />
                </View>
              ) : null}
            </View>

            {newItemType === "custom" ? (
              <>
                <Text style={styles.fieldLabel}>Target year</Text>
                <NumericInput
                  style={styles.input}
                  value={newItemGoalTargetYear}
                  onChangeText={setNewItemGoalTargetYear}
                  keyboardType="number-pad"
                  placeholder="e.g. 2030"
                  placeholderTextColor={T.textMuted}
                />
                <Text style={styles.fieldHelpText}>
                  We will create a linked goal and keep this sacrifice visible in Goals.
                </Text>
              </>
            ) : null}
          </View>

          {newItemType === "custom" ? (
            <View style={styles.inlineInfoCard}>
              <Text style={styles.inlineInfoText}>
                Your pay-period amount controls what gets set aside now. The goal target tells the app what this sacrifice is building toward.
              </Text>
            </View>
          ) : null}
        </>
      );
    }

    if (manageScreen === "link") {
      return (
        <>
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Sacrifice target</Text>
            <View style={styles.pillWrap}>
              {targets.map((target) => (
                <Pressable key={target.key} style={[styles.pill, target.key === linkTargetKey && styles.pillActive]} onPress={() => selectLinkTarget(target.key)}>
                  <Text style={[styles.pillText, target.key === linkTargetKey && styles.pillTextActive]}>{target.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Goal</Text>
            <View style={styles.pillWrap}>
              {(props.sacrifice?.goals ?? []).map((goal) => (
                <Pressable key={goal.id} style={[styles.pill, goal.id === linkGoalId && styles.pillActive]} onPress={() => setLinkGoalId(goal.id)}>
                  <Text style={[styles.pillText, goal.id === linkGoalId && styles.pillTextActive]}>{goal.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      );
    }

    return (
      <View style={styles.chooserStack}>
        <Animated.View
          style={[
            styles.chooserHero,
            {
              opacity: chooserIntro,
              transform: [{ translateY: chooserHeroTranslateY }],
            },
          ]}
        >
          <View style={[styles.chooserHeroGlow, styles.chooserHeroGlowPrimary]} />
          <View style={[styles.chooserHeroGlow, styles.chooserHeroGlowSecondary]} />
          <View style={styles.chooserHeroBadge}>
            <Ionicons name="sparkles-outline" size={13} color={T.accent} />
            <Text style={styles.chooserHeroBadgeText}>Sacrifices</Text>
          </View>
          <Text style={styles.chooserHeroAmount}>{fmt(chooserPeriodTotal, props.currency)}</Text>
          <Text style={styles.chooserHeroCaption}>Total set aside for this period</Text>
          <View style={styles.chooserHeroStatsRow}>
            <View style={styles.chooserHeroStatCard}>
              <Text style={styles.chooserHeroStatLabel}>Overall total so far</Text>
              <Text style={styles.chooserHeroStatValue}>{fmt(chooserOverallTotal, props.currency)}</Text>
            </View>
            <View style={styles.chooserHeroStatCard}>
              <Text style={styles.chooserHeroStatLabel}>Active targets</Text>
              <Text style={styles.chooserHeroStatValue}>{chooserTargetCount}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: chooserIntro,
            transform: [{ translateY: chooserCardsTranslateY }, { scale: chooserCardsScale }],
          }}
        >
          <View style={styles.targetCardList}>
            {coreTargetCards.map((target) => (
              <Pressable
                key={target.key}
                style={({ pressed }) => [styles.targetCard, pressed && styles.targetCardPressed]}
                onPress={() => openTargetEditor(target.key)}
              >
                <View style={styles.targetCardMainRow}>
                  <View style={styles.targetCardLead}>
                    <View
                      style={[
                        styles.targetCardIcon,
                        {
                          backgroundColor: `${target.iconTone}18`,
                          borderColor: `${target.iconTone}3d`,
                        },
                      ]}
                    >
                      <Ionicons name={target.iconName as any} size={18} color={target.iconTone} />
                    </View>
                    <View style={styles.targetCardCopy}>
                      <Text style={styles.targetCardTitle}>{target.title}</Text>
                      <Text style={styles.targetCardMeta}>{target.meta}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.targetCardAmountBadge,
                      {
                        backgroundColor: `${target.iconTone}14`,
                        borderColor: `${target.iconTone}33`,
                      },
                    ]}
                  >
                    <Text style={styles.targetCardAmount}>{fmt(target.totalAmount, props.currency)}</Text>
                  </View>
                </View>
                <View style={styles.targetCardMetaRow}>
                  <View style={styles.targetCardDuePill}>
                    <Text style={styles.targetCardDueLabel}>Due this period</Text>
                    <Text style={styles.targetCardDueText}>{fmt(target.dueAmount, props.currency)}</Text>
                  </View>
                  {target.linkedGoal ? (
                    <View style={styles.targetCardGoalPill}>
                      <Ionicons name="flag-outline" size={12} color={T.textMuted} />
                      <Text style={styles.targetCardGoalText} numberOfLines={1}>{target.linkedGoal.title}</Text>
                    </View>
                  ) : null}
                </View>
                {target.linkedGoal && target.linkedGoal.targetAmount > 0 ? (
                  <View style={styles.targetCardProgressMeta}>
                    <Text style={styles.targetCardProgressLabel}>Progress to target</Text>
                    <Text style={styles.targetCardProgressValue}>
                      {fmt(target.linkedGoal.currentAmount, props.currency)} / {fmt(target.linkedGoal.targetAmount, props.currency)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.targetCardChevronWrap}>
                  <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                </View>
                {target.linkedGoal && target.linkedGoal.targetAmount > 0 ? (
                  <View style={styles.targetCardAccentTrack}>
                    <View
                      style={[
                        styles.targetCardAccentFill,
                        {
                          width: `${target.linkedGoal.progressPct}%` as `${number}%`,
                          backgroundColor: target.iconTone,
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          <View style={styles.targetSectionDivider}>
            <Text style={styles.targetSectionTitle}>Custom sacrifices</Text>
            <View style={styles.targetSectionCountPill}>
              <Text style={styles.targetSectionCountText}>{customTargetCards.length} item{customTargetCards.length === 1 ? "" : "s"}</Text>
            </View>
          </View>

          {customTargetCards.length > 0 ? (
            <View style={styles.targetCardList}>
              {customTargetCards.map((target) => (
                <Pressable
                  key={target.key}
                  style={({ pressed }) => [styles.targetCard, pressed && styles.targetCardPressed]}
                  onPress={() => openTargetEditor(target.key)}
                >
                  <View style={styles.targetCardMainRow}>
                    <View style={styles.targetCardLead}>
                      <View
                        style={[
                          styles.targetCardIcon,
                          {
                            backgroundColor: `${target.iconTone}18`,
                            borderColor: `${target.iconTone}3d`,
                          },
                        ]}
                      >
                        <Ionicons name={target.iconName as any} size={18} color={target.iconTone} />
                      </View>
                      <View style={styles.targetCardCopy}>
                        <Text style={styles.targetCardTitle}>{target.title}</Text>
                        <Text style={styles.targetCardMeta}>{target.meta}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.targetCardAmountBadge,
                        {
                          backgroundColor: `${target.iconTone}14`,
                          borderColor: `${target.iconTone}33`,
                        },
                      ]}
                    >
                      <Text style={styles.targetCardAmount}>{fmt(target.totalAmount, props.currency)}</Text>
                    </View>
                  </View>
                  <View style={styles.targetCardMetaRow}>
                    <View style={styles.targetCardDuePill}>
                      <Text style={styles.targetCardDueLabel}>Due this period</Text>
                      <Text style={styles.targetCardDueText}>{fmt(target.dueAmount, props.currency)}</Text>
                    </View>
                    {target.linkedGoal ? (
                      <View style={styles.targetCardGoalPill}>
                        <Ionicons name="flag-outline" size={12} color={T.textMuted} />
                        <Text style={styles.targetCardGoalText} numberOfLines={1}>{target.linkedGoal.title}</Text>
                      </View>
                    ) : null}
                  </View>
                  {target.linkedGoal && target.linkedGoal.targetAmount > 0 ? (
                    <View style={styles.targetCardProgressMeta}>
                      <Text style={styles.targetCardProgressLabel}>Progress to target</Text>
                      <Text style={styles.targetCardProgressValue}>
                        {fmt(target.linkedGoal.currentAmount, props.currency)} / {fmt(target.linkedGoal.targetAmount, props.currency)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.targetCardChevronWrap}>
                    <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                  </View>
                  {target.linkedGoal && target.linkedGoal.targetAmount > 0 ? (
                    <View style={styles.targetCardAccentTrack}>
                      <View
                        style={[
                          styles.targetCardAccentFill,
                          {
                            width: `${target.linkedGoal.progressPct}%` as `${number}%`,
                            backgroundColor: target.iconTone,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Ionicons name="sparkles-outline" size={18} color={T.textMuted} />
              <Text style={styles.emptyStateText}>No custom sacrifices yet.</Text>
            </View>
          )}
        </Animated.View>
      </View>
    );
  };

  const renderManageFooter = () => {
    if (manageScreen === "detail") {
      const isInvestmentTarget = selectedTarget?.key === "monthlyInvestmentContribution";

      return (
        <View style={styles.manageFooterRow}>
          <View style={styles.manageFooterLeftGroup}>
            {!isInvestmentTarget ? renderFooterButton({
              label: props.sacrificeSaving ? "Saving" : "Save",
              onPress: submitAmountSheet,
              disabled: props.sacrificeSaving,
              accent: true,
            }) : null}
          </View>
          {isInvestmentTarget ? renderFooterButton({
            label: "",
            iconName: "add",
            accessibilityLabel: "Add investment sacrifice",
            onPress: openInvestmentAddActionSheet,
            disabled: props.sacrificeCreating,
          }) : null}
        </View>
      );
    }

    if (manageScreen === "add-item") {
      return (
        <Pressable style={[styles.primaryBtn, props.sacrificeCreating && styles.disabled]} onPress={submitAddItemSheet} disabled={props.sacrificeCreating}>
          <Text style={styles.primaryBtnText}>
            {props.sacrificeCreating ? "Saving..." : newItemType === "custom" ? "Create linked goal" : "Create item"}
          </Text>
        </Pressable>
      );
    }

    if (manageScreen === "link") {
      return (
        <View style={styles.footerButtonStack}>
          <Pressable style={styles.secondaryBtn} onPress={() => setLinkGoalId("")}> 
            <Text style={styles.secondaryBtnText}>Unlink from goal</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, props.goalLinkSaving && styles.disabled]} onPress={submitGoalLink} disabled={props.goalLinkSaving}>
            <Text style={styles.primaryBtnText}>{props.goalLinkSaving ? "Saving..." : "Save link"}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.manageFooterRow}>
        <View style={styles.manageFooterLeftGroup} />
        {renderFooterButton({
          label: "",
          iconName: "add",
          accessibilityLabel: "Add sacrifice item",
          onPress: openAddActionSheet,
          disabled: props.sacrificeCreating,
        })}
      </View>
    );
  };

  const renderInvestmentEditSheet = () => {
    if (manageScreen !== "detail" || !editingInvestmentRoute) return null;

    const currentAmountValue = Math.max(0, Number(editingInvestmentRoute.currentAmount ?? 0));
    const draftAmountValue = parseMoney(editInvestmentAmountDraft) ?? 0;

    return (
      <Modal transparent visible animationType="slide" onRequestClose={closeInvestmentEditSheet}>
        <View style={styles.investmentSheetOverlay}>
          <Pressable style={styles.investmentSheetScrim} onPress={closeInvestmentEditSheet} />
          <View style={[styles.investmentSheetPanel, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
            <View style={styles.investmentSheetHandle} />
            <View style={styles.investmentSheetHero}>
              <View style={styles.investmentSheetHeroIcon}>
                <Ionicons name="trending-up-outline" size={20} color="#22f0b2" />
              </View>
              <Text style={styles.investmentSheetTitle}>{editingInvestmentRoute.name}</Text>
              <Text style={styles.investmentSheetHeroAmount}>{fmt(draftAmountValue, props.currency)}</Text>
            </View>

            <View style={styles.investmentSheetStatsRow}>
              <View style={styles.investmentSheetStatCard}>
                <Text style={styles.investmentSheetStatLabel}>Current</Text>
                <Text style={styles.investmentSheetStatValue}>{fmt(currentAmountValue, props.currency)}</Text>
              </View>
              <View style={styles.investmentSheetStatCard}>
                <Text style={styles.investmentSheetStatLabel}>New</Text>
                <Text style={styles.investmentSheetStatValue}>{fmt(draftAmountValue, props.currency)}</Text>
              </View>
            </View>

            <Text style={styles.investmentSheetFieldLabel}>Broker</Text>
            <OverlaySelectInput
              value={normalizeBrokerValue(editInvestmentBroker)}
              onChange={(next) => {
                setEditInvestmentBroker(next);
                if (!isManualBrokerSelection(next)) {
                  setEditInvestmentBrokerManualDraft("");
                }
              }}
              options={investmentBrokerDropdownOptions}
              triggerStyle={styles.input}
              placeholder="Select broker"
            />

            {isManualBrokerSelection(editInvestmentBroker) ? (
              <TextInput
                style={styles.input}
                value={editInvestmentBrokerManualDraft}
                onChangeText={setEditInvestmentBrokerManualDraft}
                placeholder="Add broker manually"
                placeholderTextColor={T.textMuted}
              />
            ) : null}

            <Text style={styles.investmentSheetFieldLabel}>Amount for this period</Text>
            <MoneyInput
              currency={props.currency}
              value={editInvestmentAmountDraft}
              onChangeValue={setEditInvestmentAmountDraft}
              placeholder="0.00"
            />

            <View style={styles.investmentSheetActionsRow}>
              <Pressable
                style={[styles.investmentSheetActionBtn, styles.investmentSheetActionBtnSecondary]}
                onPress={closeInvestmentEditSheet}
              >
                <Text style={styles.investmentSheetActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.investmentSheetActionBtn, styles.investmentSheetActionBtnPrimary]}
                onPress={() => {
                  void saveInvestmentEditSheet();
                }}
              >
                <Text style={styles.investmentSheetActionText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAddActionSheet = () => {
    if (!addActionSheetOpen) return null;

    return (
      <Modal transparent visible animationType="fade" onRequestClose={closeAddActionSheet}>
        <View style={styles.detailOptionsSheetOverlay}>
          <Pressable style={styles.detailOptionsSheetScrim} onPress={closeAddActionSheet} />
          <View style={[styles.detailOptionsSheetPanel, { height: "82%", paddingBottom: Math.max(insets.bottom + 20, 28) }]}> 
            <View style={styles.detailOptionsSheetHandle} />
            <View style={styles.detailOptionsSheetHeader}>
              <Text style={styles.detailOptionsSheetTitle}>Add investment item</Text>
              <Pressable style={styles.detailOptionsSheetCloseBtn} onPress={closeAddActionSheet}>
                <Ionicons name="close" size={14} color={T.text} />
              </Pressable>
            </View>
            <>
              <ScrollView
                style={styles.detailOptionsSheetScroll}
                contentContainerStyle={styles.detailOptionsSheetScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.sectionCard}>
                  <Text style={styles.cardTitle}>Investment details</Text>
                  <Text style={styles.cardSub}>
                    Choose the investment bucket you want to fund for this period, or enter your own label.
                  </Text>

                  <Text style={styles.fieldLabel}>Investment bucket</Text>
                  <View style={styles.pillWrap}>
                    {INVESTMENT_BUCKET_OPTIONS.map((option) => {
                      const active = newItemName.trim().toLowerCase() === option.toLowerCase();

                      return (
                        <Pressable
                          key={option}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setNewItemName(option)}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="Stocks, Crypto, Commodities, or type Broker"
                    placeholderTextColor={T.textMuted}
                  />
                  <Text style={styles.fieldHelpText}>The Investments heading stays grouped, but each bucket can be funded separately.</Text>

                  <Text style={styles.fieldLabel}>Broker</Text>
                  <OverlaySelectInput
                    value={normalizeBrokerValue(newItemBroker)}
                    onChange={(next) => {
                      setNewItemBroker(next);
                      if (!isManualBrokerSelection(next)) {
                        setNewBrokerDraft("");
                      }
                    }}
                    options={investmentBrokerDropdownOptions}
                    triggerStyle={styles.input}
                    placeholder="Select broker"
                  />

                  {isManualBrokerSelection(newItemBroker) ? (
                    <>
                      <TextInput
                        style={styles.input}
                        value={newBrokerDraft}
                        onChangeText={setNewBrokerDraft}
                        placeholder="Add broker manually"
                        placeholderTextColor={T.textMuted}
                      />
                      <Text style={styles.fieldHelpText}>If you add a broker here, it will be saved and available in this dropdown next time.</Text>
                    </>
                  ) : (
                    <Text style={styles.fieldHelpText}>Pick from brokers saved in Settings or choose + Add new broker.</Text>
                  )}

                  <Text style={styles.fieldLabel}>Starting amount</Text>
                  <MoneyInput
                    currency={props.currency}
                    value={newItemAmount}
                    onChangeValue={setNewItemAmount}
                    placeholder="0.00"
                  />
                </View>
              </ScrollView>

              <Pressable
                style={[styles.primaryBtn, props.sacrificeCreating && styles.disabled]}
                onPress={submitAddItemSheet}
                disabled={props.sacrificeCreating}
              >
                <Text style={styles.primaryBtnText}>{props.sacrificeCreating ? "Saving..." : "Create item"}</Text>
              </Pressable>
            </>
          </View>
        </View>
      </Modal>
    );
  };

  if (manageScreen) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.manageScreen, manageScreen === "detail" && styles.manageScreenDetail]}>
          <View style={[styles.manageHeaderShell, manageScreen === "detail" && styles.manageHeaderShellDetail]}>
            <View style={[styles.manageHeaderTint, manageScreen === "detail" && styles.manageHeaderTintDetail]} />
            <View style={[styles.manageHeader, manageScreen === "detail" && styles.manageHeaderDetail, { paddingTop: props.topInset ?? 0 }]}> 
              <Pressable style={[styles.manageBackBtn, manageScreen === "detail" && styles.manageBackBtnDetail]} onPress={goBackFromManageScreen}>
                <Ionicons name="chevron-back" size={20} color={T.text} />
              </Pressable>
              <View pointerEvents="none" style={styles.manageHeaderCenterWrap}>
                {manageHeaderTitle ? <Text style={styles.manageTitle} numberOfLines={1}>{manageHeaderTitle}</Text> : null}
              </View>
              <View style={styles.manageHeaderSpacer} />
            </View>
          </View>

          <ScrollView
            style={[styles.manageScroll, manageScreen === "detail" && styles.manageScrollDetail]}
            onScroll={handleManageScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[
              styles.manageScrollContent,
              manageScreen === "detail" && styles.manageScrollContentDetail,
              { paddingBottom: 84 + insets.bottom },
            ]}
          >
            {renderManageContent()}
          </ScrollView>

          <View style={[styles.fixedFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}> 
            <Animated.View pointerEvents="none" style={[styles.fixedFooterBackdrop, { opacity: footerBackdropOpacity }]}> 
              <BlurView intensity={26} tint="dark" style={styles.fixedFooterBackdropBlur} />
              <View style={styles.fixedFooterBackdropTint} />
            </Animated.View>
            {renderManageFooter()}
          </View>

          {renderInvestmentEditSheet()}
          {renderAddActionSheet()}
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.mainScreen}>
        {props.sacrifice ? (
          <FlatList
            data={[]}
            keyExtractor={(_, idx) => String(idx)}
            style={styles.mainList}
            onScroll={handleMainScroll}
            scrollEventThrottle={16}
            bounces={false}
            contentContainerStyle={[s.scroll, { paddingTop: props.topInset ?? 0, paddingBottom: canManage ? 72 + insets.bottom : 40 }]}
            refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={T.accent} />}
            ListHeaderComponent={
              <View style={styles.wrap}>
                {props.pendingNoticeText ? (
                  null
                ) : null}

                <IncomeSacrificePieChart
                  currency={props.currency}
                  slices={pieSlices}
                  centerTitle={props.monthLabel}
                  onSlicePress={canManage ? handleOverviewSlicePress : undefined}
                />

                {activeSacrificeTip ? (
                  <View style={styles.aiTipCard}>
                    <View style={styles.aiTipHeader}>
                      <Ionicons name="bulb-outline" size={16} color={T.accent} />
                      <Text style={styles.aiTipTitle}>{t("income.sacrifice.aiTipLabel")}</Text>
                    </View>
                    <Text style={styles.aiTipHeadline}>{activeSacrificeTip.title}</Text>
                    <Text style={styles.aiTipText}>{activeSacrificeTip.detail}</Text>
                    {sacrificeTips.length > 1 ? (
                      <View style={styles.aiTipDots}>
                        {sacrificeTips.map((tip, index) => (
                          <View
                            key={`${tip.title}-${index}`}
                            style={[styles.aiTipDot, index === activeTipIndex ? styles.aiTipDotActive : null]}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {canManage ? (
                  <View style={styles.buttonSpacer} />
                ) : null}

              </View>
            }
            ListEmptyComponent={null}
            renderItem={() => null}
          />
        ) : (
          <View
            style={[
              styles.loadingState,
              {
                paddingTop: props.topInset ?? 0,
                paddingBottom: canManage ? 72 + insets.bottom : 40,
              },
            ]}
          >
            <View style={styles.loadingInner}>
              <ActivityIndicator size="small" color={T.accent} />
            </View>
          </View>
        )}

        {canManage ? (
          <View style={[styles.fixedFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}> 
            <Animated.View pointerEvents="none" style={[styles.fixedFooterBackdrop, { opacity: footerBackdropOpacity }]}> 
              <BlurView intensity={26} tint="dark" style={styles.fixedFooterBackdropBlur} />
              <View style={styles.fixedFooterBackdropTint} />
            </Animated.View>
            <View style={styles.mainFooterRow}>
                <View style={styles.mainFooterLeftGroup}>
                  {renderFooterButton({
                    label: "Edit",
                    onPress: openManageFlow,
                    disabled: props.sacrificeSaving,
                  })}
                </View>
              <View style={styles.mainFooterRightGroup}>
                {renderFooterButton({
                  label: "Current",
                  onPress: props.onGoToCurrentPeriod,
                  disabled: !props.onGoToCurrentPeriod,
                })}
                {renderFooterButton({
                  label: "Next",
                  onPress: props.onGoToNextPeriod,
                  disabled: !props.onGoToNextPeriod,
                  accent: true,
                })}
              </View>
            </View>
          </View>
        ) : null}

        {renderAddActionSheet()}
      </View>
    </GestureHandlerRootView>
  );
}
