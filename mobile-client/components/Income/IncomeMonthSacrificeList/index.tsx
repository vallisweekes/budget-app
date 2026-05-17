import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ActivityIndicator, Animated, FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./styles";

import { fmt } from "@/lib/formatting";
import { parseMoney } from "@/lib/domain/moneyInput";
import { getPayPeriodRangeLabelFromSelection, getPayPeriodSelectionFromAnchor } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import { s } from "@/components/IncomeMonthScreen/style";
import IncomeSacrificePieChart from "@/components/Income/IncomeSacrificePieChart";
import type {
  AmountEntryMode,
  GlassEffectModule,
  IncomeMonthSacrificeListProps,
  IncomeSacrificeItemType,
  SacrificePeriod,
  TargetOption,
} from "@/types";

const ADD_ITEM_TYPES: Array<{ key: IncomeSacrificeItemType; label: string }> = [
  { key: "allowance", label: "Allowance" },
  { key: "savings", label: "Savings" },
  { key: "emergency", label: "Emergency" },
  { key: "investment", label: "Investment" },
  { key: "custom", label: "Custom" },
];

const MONTH_CHIPS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

export default function IncomeMonthSacrificeList(props: IncomeMonthSacrificeListProps) {
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
  const [linkTargetKey, setLinkTargetKey] = useState("");
  const [linkGoalId, setLinkGoalId] = useState<string>("");
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [mainFooterBlurActive, setMainFooterBlurActive] = useState(false);
  const [manageFooterBlurActive, setManageFooterBlurActive] = useState(false);
  const canManage = props.canManage ?? true;
  const isMonthlyCadence = props.payFrequency === "monthly";
  const chooserIntro = useRef(new Animated.Value(0)).current;
  const detailIntro = useRef(new Animated.Value(0)).current;
  const footerBackdropOpacity = useRef(new Animated.Value(0)).current;
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
      return glassEffectModule.isLiquidGlassAvailable();
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

  const targets = useMemo<TargetOption[]>(() => {
    const fixed = props.sacrifice?.fixed;
    const rows: TargetOption[] = [
      { key: "monthlyAllowance", label: `Allowance (${fmt(Number(fixed?.monthlyAllowance ?? 0), props.currency)})`, kind: "fixed", fixedField: "monthlyAllowance" },
      { key: "monthlySavingsContribution", label: `Savings (${fmt(Number(fixed?.monthlySavingsContribution ?? 0), props.currency)})`, kind: "fixed", fixedField: "monthlySavingsContribution" },
      { key: "monthlyEmergencyContribution", label: `Emergency (${fmt(Number(fixed?.monthlyEmergencyContribution ?? 0), props.currency)})`, kind: "fixed", fixedField: "monthlyEmergencyContribution" },
      { key: "monthlyInvestmentContribution", label: `Investments (${fmt(Number(fixed?.monthlyInvestmentContribution ?? 0), props.currency)})`, kind: "fixed", fixedField: "monthlyInvestmentContribution" },
    ];

    const customRows = (props.sacrifice?.customItems ?? []).map((item) => ({
      key: `custom:${item.id}`,
      label: `${item.name} (${fmt(Number(item.amount ?? 0), props.currency)})`,
      kind: "custom" as const,
      customAllocationId: item.id,
    }));

    return [...rows, ...customRows];
  }, [props.currency, props.sacrifice?.customItems, props.sacrifice?.fixed]);

  const pieSlices = useMemo(() => {
    if (!props.sacrifice) return [];
    return [
      { key: "allowance", label: "Allowance", value: Number(props.sacrifice.fixed.monthlyAllowance ?? 0), color: T.orange },
      { key: "savings", label: "Savings", value: Number(props.sacrifice.fixed.monthlySavingsContribution ?? 0), color: T.accent },
      { key: "emergency", label: "Emergency", value: Number(props.sacrifice.fixed.monthlyEmergencyContribution ?? 0), color: T.text },
      { key: "investments", label: "Investments", value: Number(props.sacrifice.fixed.monthlyInvestmentContribution ?? 0), color: T.green },
      { key: "custom", label: "Custom", value: Number(props.sacrifice.customTotal ?? 0), color: T.red },
    ];
  }, [props.sacrifice]);

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
      return Number(props.sacrifice.fixed.monthlySavingsContribution ?? 0);
    }
    if (key === "monthlyEmergencyContribution") {
      return Number(props.sacrifice.fixed.monthlyEmergencyContribution ?? 0);
    }
    if (key === "monthlyInvestmentContribution") {
      return Number(props.sacrifice.fixed.monthlyInvestmentContribution ?? 0);
    }
    if (key.startsWith("custom:")) {
      const customId = key.slice("custom:".length);
      const item = props.sacrifice.customItems.find((row) => row.id === customId);
      return Number(item?.amount ?? 0);
    }

    return 0;
  }, [props.sacrifice]);

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
        title: "Start with one small sacrifice",
        detail: "Set one amount for this period first, then extend it across future periods once it feels sustainable.",
        priority: 90,
      });
    }

    if (allowance > 0 && savings + emergency + investments + customTotal === 0) {
      tips.push({
        title: "Most of this period goes to allowance",
        detail: `Consider moving a small share of ${fmt(total, props.currency)} into savings or emergency so it is not all immediately available to spend.`,
        priority: 85,
      });
    }

    if (emergency <= 0 && total > 0) {
      tips.push({
        title: "Emergency cover is still empty",
        detail: `With ${fmt(total, props.currency)} already set aside, even a small emergency allocation can make future periods less fragile.`,
        priority: 80,
      });
    }

    if (customCount > 0) {
      tips.push({
        title: "Custom sacrifices are active",
        detail: `You have ${customCount} custom sacrifice${customCount === 1 ? "" : "s"} in this plan. Keep each one specific so it stays easy to review.`,
        priority: 65,
      });
    }

    if (!tips.length) {
      tips.push({
        title: "This sacrifice split looks balanced",
        detail: "Review the start period before saving longer ranges so the same split carries forward from the right pay-period anchor.",
        priority: 60,
      });
    }

    return tips;
  }, [props.currency, props.sacrifice]);

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

  const openSelectedTargetLinkScreen = () => {
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
  const parsedInlineAmount = useMemo(() => parseMoney(amountDraft), [amountDraft]);
  const previewCurrentAmount = isInlineAmountEditing && parsedInlineAmount != null ? parsedInlineAmount : selectedCurrentAmount;
  const previewDisplayTotal = useMemo(() => {
    if (!(isInlineAmountEditing && parsedInlineAmount != null)) return selectedDisplayTotal;
    return Math.max(0, selectedDisplayTotal - selectedCurrentAmount + parsedInlineAmount);
  }, [isInlineAmountEditing, parsedInlineAmount, selectedCurrentAmount, selectedDisplayTotal]);

  const selectedPayPeriodLabel = useMemo(() => {
    return getPayPeriodRangeLabelFromSelection({
      year: startYear,
      month: startMonth,
      payDate: props.payDate,
      payFrequency: props.payFrequency,
    });
  }, [props.payDate, props.payFrequency, startMonth, startYear]);

  const currentPayPeriodLabel = useMemo(() => {
    return getPayPeriodRangeLabelFromSelection({
      year: props.year,
      month: props.month,
      payDate: props.payDate,
      payFrequency: props.payFrequency,
    });
  }, [props.month, props.payDate, props.payFrequency, props.year]);

  const periodOptions = useMemo<Array<{ key: SacrificePeriod; label: string }>>(() => {
    if (isMonthlyCadence) {
      return [
        { key: "this_month", label: "This period" },
        { key: "next_six_months", label: "Next 6 periods" },
        { key: "remaining_months", label: "Remaining periods" },
        { key: "two_years", label: "2 years" },
        { key: "five_years", label: "5 years" },
        { key: "ten_years", label: "10 years" },
      ];
    }

    return [
      { key: "this_month", label: "This anchor month" },
      { key: "next_six_months", label: "Next 6 anchor months" },
      { key: "remaining_months", label: "Remaining anchor months" },
      { key: "two_years", label: "2 years" },
      { key: "five_years", label: "5 years" },
      { key: "ten_years", label: "10 years" },
    ];
  }, [isMonthlyCadence]);

  const primaryPeriodOptions = useMemo(() => {
    return periodOptions.filter((option) => (
      option.key === "this_month" || option.key === "next_six_months" || option.key === "remaining_months"
    ));
  }, [periodOptions]);

  const secondaryPeriodOptions = useMemo(() => {
    return periodOptions.filter((option) => (
      option.key === "two_years" || option.key === "five_years" || option.key === "ten_years"
    ));
  }, [periodOptions]);
  const selectedPeriodLabel = useMemo(
    () => periodOptions.find((option) => option.key === period)?.label ?? "This period",
    [period, periodOptions],
  );

  const renderFooterButton = useCallback(({
    label,
    onPress,
    disabled,
    accent,
  }: {
    label: string;
    onPress?: (() => void) | null;
    disabled?: boolean;
    accent?: boolean;
  }) => {
    const isDisabled = Boolean(disabled || !onPress);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.mainFooterBtn,
          accent && styles.mainFooterBtnAccent,
          pressed && styles.mainFooterBtnPressed,
          isDisabled && styles.disabled,
        ]}
        onPress={onPress ?? undefined}
        disabled={isDisabled}
      >
        <BlurView
          intensity={accent ? 42 : 34}
          tint={accent ? "dark" : "systemChromeMaterialLight"}
          style={[styles.mainFooterBtnBlur, accent && styles.mainFooterBtnBlurAccent]}
        >
          {liquidGlassEnabled && GlassView ? (
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              tintColor="rgba(255,255,255,0)"
              style={styles.mainFooterBtnGlass}
            />
          ) : null}
          <View style={[styles.mainFooterBtnInner, accent && styles.mainFooterBtnInnerAccent]} />
          <Text style={[styles.mainFooterBtnText, accent && styles.mainFooterBtnTextAccent]}>{label}</Text>
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
    const currentAmount = getCurrentAmountForTarget(key);
    setAmountMode("set");
    setAmountDraft(currentAmount.toFixed(2));
    setIsInlineAmountEditing(false);
    setManageScreen("detail");
  };

  const handleOverviewSlicePress = useCallback((sliceKey: string) => {
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
  }, [canManage, customTargetCards, openManageFlow, openTargetEditor]);

  const goBackFromManageScreen = () => {
    setIsInlineAmountEditing(false);
    if (manageScreen === "detail" || manageScreen === "add-item") {
      setManageScreen("chooser");
      return;
    }
    if (manageScreen === "link") {
      setManageScreen("detail");
      return;
    }
    setManageScreen(null);
  };

  const submitAmountSheet = async () => {
    const selected = targets.find((target) => target.key === targetKey);
    const enteredAmount = parseMoney(amountDraft);
    const normalizedStartMonth = normalizeMonthValue(startMonth);
    const normalizedStartYear = normalizeYearValue(startYear);

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

    const finalAmount = amountMode === "adjust" ? selectedCurrentAmount + enteredAmount : enteredAmount;
    if (finalAmount < 0) {
      Alert.alert("Invalid amount", "Adjustment would make this sacrifice negative.");
      return;
    }

    await props.onApplySacrificeAmount({
      targetType: selected.kind,
      fixedField: selected.fixedField,
      customAllocationId: selected.customAllocationId,
      amount: finalAmount,
      startMonth: normalizedStartMonth,
      startYear: normalizedStartYear,
      period,
    });
    setIsInlineAmountEditing(false);
    setManageScreen(null);
  };

  const submitAddItemSheet = async () => {
    await props.onCreateItem({
      type: newItemType,
      name: newItemName,
    });
    setNewItemType("custom");
    setNewItemName("");
    setManageScreen("chooser");
  };

  const toggleInlineAmountEdit = useCallback(() => {
    if (isInlineAmountEditing) {
      setAmountMode("set");
      setAmountDraft(selectedCurrentAmount.toFixed(2));
      setIsInlineAmountEditing(false);
      return;
    }

    setAmountMode("set");
    setAmountDraft(selectedCurrentAmount.toFixed(2));
    setIsInlineAmountEditing(true);
  }, [isInlineAmountEditing, selectedCurrentAmount]);

  const manageHeaderTitle = manageScreen === "detail"
    ? null
    : manageScreen === "add-item"
      ? "Add sacrifice item"
      : manageScreen === "link"
        ? "Link sacrifice to goal"
        : null;

  const renderManageContent = () => {
    if (manageScreen === "detail") {
      return (
        <>
          <Animated.View
            style={[
              styles.detailHero,
              {
                opacity: detailIntro,
                transform: [{ translateY: detailHeroTranslateY }],
              },
            ]}
          >
            <View style={[styles.detailHeroGlow, styles.detailHeroGlowPrimary]} />
            <View style={[styles.detailHeroGlow, styles.detailHeroGlowSecondary]} />
            <View style={styles.detailHeroBadge}>
              <Ionicons name="sparkles-outline" size={13} color={selectedTargetCard?.iconTone ?? T.accent} />
              <Text style={styles.detailHeroBadgeText}>{selectedTarget?.kind === "fixed" ? "Fixed target" : "Custom target"}</Text>
            </View>
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
            <View style={styles.detailHeroStatsRow}>
              <View style={styles.detailHeroStatCard}>
                <Text style={styles.detailHeroStatLabel}>{selectedTarget?.kind === "fixed" ? "Due this period" : "Target type"}</Text>
                <Text style={styles.detailHeroStatValue}>
                  {selectedTarget?.kind === "fixed" ? fmt(previewCurrentAmount, props.currency) : "Custom"}
                </Text>
              </View>
              <View style={styles.detailHeroStatCard}>
                <Text style={styles.detailHeroStatLabel}>Applying across</Text>
                <Text style={styles.detailHeroStatValueSmall}>{selectedPeriodLabel}</Text>
              </View>
            </View>
            {selectedTarget?.kind === "fixed" ? (
              <View style={styles.detailEditorCard}>
                <Text style={styles.detailEditorLabel}>Due this pay period</Text>
                {isInlineAmountEditing ? (
                  <View style={styles.detailHeroInlineEditWrap}>
                    <Text style={styles.detailHeroInlineCurrency}>{props.currency}</Text>
                    <TextInput
                      value={amountDraft}
                      onChangeText={setAmountDraft}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="rgba(255,255,255,0.42)"
                      autoFocus
                      style={styles.detailHeroInlineInput}
                    />
                  </View>
                ) : (
                  <Text style={styles.detailEditorValue}>{fmt(previewCurrentAmount, props.currency)}</Text>
                )}
              </View>
            ) : null}
            {isInlineAmountEditing ? (
              <Pressable style={styles.detailHeroRemoveBtn} onPress={() => {
                setAmountMode("set");
                setAmountDraft("0.00");
              }}>
                <Text style={styles.detailHeroRemoveText}>Set to 0</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          <Animated.View
            style={{
              opacity: detailIntro,
              transform: [{ translateY: detailContentTranslateY }],
            }}
          >
            <View style={styles.detailSectionCard}>
              <View style={styles.detailSectionHeader}>
                <Text style={styles.detailSectionTitle}>Apply across</Text>
                <View style={styles.detailSectionPill}>
                  <Text style={styles.detailSectionPillText}>{selectedPeriodLabel}</Text>
                </View>
              </View>
              <Text style={styles.detailSectionHelp}>
                {isMonthlyCadence
                  ? "These options follow your pay-period anchor for each saved month."
                  : "Sacrifice amounts are saved by pay-period anchor month, so weekly and biweekly periods inside the same anchor month share one saved value."}
              </Text>
              <View style={styles.detailOptionGrid}>
                {primaryPeriodOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    style={[styles.detailOptionCard, option.key === period && styles.detailOptionCardActive]}
                    onPress={() => setPeriod(option.key)}
                  >
                    <Text style={[styles.detailOptionCardTitle, option.key === period && styles.detailOptionCardTitleActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.detailPillWrap}>
                {secondaryPeriodOptions.map((option) => (
                  <Pressable key={option.key} style={[styles.detailPill, option.key === period && styles.detailPillActive]} onPress={() => setPeriod(option.key)}>
                    <Text style={[styles.detailPillText, option.key === period && styles.detailPillTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        </>
      );
    }

    if (manageScreen === "add-item") {
      return (
        <>
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Item type</Text>
            <View style={styles.pillWrap}>
              {ADD_ITEM_TYPES.map((type) => (
                <Pressable key={type.key} style={[styles.pill, type.key === newItemType && styles.pillActive]} onPress={() => setNewItemType(type.key)}>
                  <Text style={[styles.pillText, type.key === newItemType && styles.pillTextActive]}>{type.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={newItemType === "custom" ? "Custom item name" : "Optional custom label"}
              placeholderTextColor={T.textMuted}
            />
          </View>
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
                <View style={[styles.targetCardGlow, { backgroundColor: `${target.iconTone}12` }]} />
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
                  <>
                    <View style={styles.targetCardProgressMeta}>
                      <Text style={styles.targetCardProgressLabel}>Goal progress</Text>
                      <Text style={styles.targetCardProgressValue}>
                        {fmt(target.linkedGoal.currentAmount, props.currency)} / {fmt(target.linkedGoal.targetAmount, props.currency)}
                      </Text>
                    </View>
                    <View style={styles.targetCardProgressBg}>
                      <View
                        style={[
                          styles.targetCardProgressFill,
                          {
                            width: `${target.linkedGoal.progressPct}%` as `${number}%`,
                            backgroundColor: target.iconTone,
                          },
                        ]}
                      />
                    </View>
                  </>
                ) : null}
                <View style={styles.targetCardChevronWrap}>
                  <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                </View>
                <View style={[styles.targetCardAccentLine, { backgroundColor: target.iconTone }]} />
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
                  <View style={[styles.targetCardGlow, { backgroundColor: `${target.iconTone}12` }]} />
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
                    <>
                      <View style={styles.targetCardProgressMeta}>
                        <Text style={styles.targetCardProgressLabel}>Goal progress</Text>
                        <Text style={styles.targetCardProgressValue}>
                          {fmt(target.linkedGoal.currentAmount, props.currency)} / {fmt(target.linkedGoal.targetAmount, props.currency)}
                        </Text>
                      </View>
                      <View style={styles.targetCardProgressBg}>
                        <View
                          style={[
                            styles.targetCardProgressFill,
                            {
                              width: `${target.linkedGoal.progressPct}%` as `${number}%`,
                              backgroundColor: target.iconTone,
                            },
                          ]}
                        />
                      </View>
                    </>
                  ) : null}
                  <View style={styles.targetCardChevronWrap}>
                    <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                  </View>
                  <View style={[styles.targetCardAccentLine, { backgroundColor: target.iconTone }]} />
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
      return (
        <View style={styles.manageFooterRow}>
          <View style={styles.manageFooterLeftGroup}>
            {renderFooterButton({
              label: props.sacrificeSaving ? "Saving" : "Save",
              onPress: submitAmountSheet,
              disabled: props.sacrificeSaving,
              accent: true,
            })}
            {renderFooterButton({
              label: isInlineAmountEditing ? "Cancel" : "Edit",
              onPress: toggleInlineAmountEdit,
            })}
          </View>
          {renderFooterButton({
            label: "Link",
            onPress: openSelectedTargetLinkScreen,
            disabled: props.goalLinkSaving,
          })}
        </View>
      );
    }

    if (manageScreen === "add-item") {
      return (
        <Pressable style={[styles.primaryBtn, props.sacrificeCreating && styles.disabled]} onPress={submitAddItemSheet} disabled={props.sacrificeCreating}>
          <Text style={styles.primaryBtnText}>{props.sacrificeCreating ? "Saving..." : "Create item"}</Text>
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
      <Pressable style={[styles.secondaryBtn, props.sacrificeCreating && styles.disabled]} onPress={() => setManageScreen("add-item")} disabled={props.sacrificeCreating}>
        <Ionicons name="add" size={15} color={T.text} />
        <Text style={styles.secondaryBtnText}>Add custom sacrifice</Text>
      </Pressable>
    );
  };

  if (manageScreen) {
    return (
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
      </View>
    );
  }

  return (
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
                centerTitle={currentPayPeriodLabel}
                onSlicePress={canManage ? handleOverviewSlicePress : undefined}
              />

              {activeSacrificeTip ? (
                <View style={styles.aiTipCard}>
                  <View style={styles.aiTipHeader}>
                    <Ionicons name="bulb-outline" size={16} color={T.accent} />
                    <Text style={styles.aiTipTitle}>AI tip</Text>
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
            {renderFooterButton({
              label: "Edit",
              onPress: openManageFlow,
              disabled: props.sacrificeSaving,
            })}
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
    </View>
  );
}
