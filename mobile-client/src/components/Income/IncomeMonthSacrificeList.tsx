import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IncomeSacrificeData } from "@/lib/apiTypes";
import { fmt, MONTH_NAMES_LONG } from "@/lib/formatting";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { T } from "@/lib/theme";
import { s } from "@/screens/income-month/incomeMonthScreenStyles";
import IncomeSacrificePieChart from "@/components/Income/IncomeSacrificePieChart";

type SacrificePeriod =
  | "this_month"
  | "next_six_months"
  | "remaining_months"
  | "two_years"
  | "five_years"
  | "ten_years";

type AmountEntryMode = "set" | "adjust";

type TargetOption = {
  key: string;
  label: string;
  kind: "fixed" | "custom";
  fixedField?: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
  customAllocationId?: string;
};

type Props = {
  currency: string;
  month: number;
  year: number;
  sacrifice: IncomeSacrificeData | null;
  sacrificeSaving: boolean;
  sacrificeCreating: boolean;
  sacrificeDeletingId: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onApplySacrificeAmount: (args: {
    targetType: "fixed" | "custom";
    fixedField?: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
    customAllocationId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
  }) => Promise<void>;
  onDeleteCustom: (id: string) => Promise<void>;
  onCreateItem: (args: { type: "allowance" | "savings" | "emergency" | "investment" | "custom"; name: string }) => Promise<void>;
  onSaveGoalLink: (args: { targetKey: string; goalId: string | null }) => Promise<void>;
  onConfirmTransfer: (targetKey: string) => Promise<void>;
  goalLinkSaving: boolean;
  confirmingTargetKey: string | null;
  pendingNoticeText?: string;
  onDismissPendingNotice?: () => void;
};

const PERIOD_OPTIONS: Array<{ key: SacrificePeriod; label: string }> = [
  { key: "this_month", label: "This month" },
  { key: "next_six_months", label: "Next 6 months" },
  { key: "remaining_months", label: "Remaining months" },
  { key: "two_years", label: "2 years" },
  { key: "five_years", label: "5 years" },
  { key: "ten_years", label: "10 years" },
];

const ADD_ITEM_TYPES: Array<{ key: "allowance" | "savings" | "emergency" | "investment" | "custom"; label: string }> = [
  { key: "allowance", label: "Allowance" },
  { key: "savings", label: "Savings" },
  { key: "emergency", label: "Emergency" },
  { key: "investment", label: "Investment" },
  { key: "custom", label: "Custom" },
];

const MONTH_CHIPS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function IncomeMonthSacrificeList(props: Props) {
  const insets = useSafeAreaInsets();
  const [amountSheetOpen, setAmountSheetOpen] = useState(false);
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [targetKey, setTargetKey] = useState("monthlySavingsContribution");
  const [amountDraft, setAmountDraft] = useState("");
  const [amountMode, setAmountMode] = useState<AmountEntryMode>("set");
  const [period, setPeriod] = useState<SacrificePeriod>("this_month");
  const [startMonth, setStartMonth] = useState(props.month);
  const [startYear, setStartYear] = useState(props.year);

  const [newItemType, setNewItemType] = useState<"allowance" | "savings" | "emergency" | "investment" | "custom">("custom");
  const [newItemName, setNewItemName] = useState("");
  const [linkTargetKey, setLinkTargetKey] = useState("");
  const [linkGoalId, setLinkGoalId] = useState<string>("");

  const closeAmountSheet = useCallback(() => setAmountSheetOpen(false), []);
  const closeAddItemSheet = useCallback(() => setAddItemSheetOpen(false), []);
  const closeLinkSheet = useCallback(() => setLinkSheetOpen(false), []);

  const {
    dragY: amountSheetDragY,
    panHandlers: amountSheetPanHandlers,
    resetDrag: resetAmountSheetDrag,
  } = useSwipeDownToClose({ onClose: closeAmountSheet, disabled: props.sacrificeSaving });

  const {
    dragY: addItemSheetDragY,
    panHandlers: addItemSheetPanHandlers,
    resetDrag: resetAddItemSheetDrag,
  } = useSwipeDownToClose({ onClose: closeAddItemSheet, disabled: props.sacrificeCreating });

  const {
    dragY: linkSheetDragY,
    panHandlers: linkSheetPanHandlers,
    resetDrag: resetLinkSheetDrag,
  } = useSwipeDownToClose({ onClose: closeLinkSheet, disabled: props.goalLinkSaving });

  useEffect(() => {
    if (amountSheetOpen) resetAmountSheetDrag();
  }, [amountSheetOpen, resetAmountSheetDrag]);

  useEffect(() => {
    if (addItemSheetOpen) resetAddItemSheetDrag();
  }, [addItemSheetOpen, resetAddItemSheetDrag]);

  useEffect(() => {
    if (linkSheetOpen) resetLinkSheetDrag();
  }, [linkSheetOpen, resetLinkSheetDrag]);

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

  const targetLabelMap = useMemo(() => {
    const rows = new Map<string, string>();
    for (const target of targets) {
      rows.set(toLinkedTargetKey(target.key), target.label);
    }
    return rows;
  }, [targets]);

  const linkByTarget = useMemo(() => {
    const rows = new Map<string, { goalId: string; goalTitle: string }>();
    for (const link of props.sacrifice?.goalLinks ?? []) {
      rows.set(link.targetKey, { goalId: link.goalId, goalTitle: link.goalTitle });
    }
    return rows;
  }, [props.sacrifice?.goalLinks]);

  const confirmationByTarget = useMemo(() => {
    const rows = new Map<string, { amount: number; confirmedAt: string }>();
    for (const item of props.sacrifice?.confirmations ?? []) {
      rows.set(item.targetKey, { amount: Number(item.amount ?? 0), confirmedAt: item.confirmedAt });
    }
    return rows;
  }, [props.sacrifice?.confirmations]);

  const linkedRows = useMemo(() => {
    return (props.sacrifice?.goalLinks ?? []).map((link) => {
      const targetKey = link.targetKey;
      const targetLabel = targetLabelMap.get(targetKey) ?? targetKey;
      const plannedAmount = targetKey.startsWith("fixed:")
        ? getCurrentAmountForTarget(targetKey.replace("fixed:", ""))
        : getCurrentAmountForTarget(targetKey);
      const confirmation = confirmationByTarget.get(targetKey);
      return {
        targetKey,
        targetLabel,
        goalTitle: link.goalTitle,
        plannedAmount,
        confirmation,
      };
    });
  }, [props.sacrifice?.goalLinks, targetLabelMap, confirmationByTarget, props.sacrifice]);

  const openLinkSheet = () => {
    const firstTarget = targets[0]?.key ?? "monthlySavingsContribution";
    const firstTargetKey = toLinkedTargetKey(firstTarget);
    const existingGoalId = linkByTarget.get(firstTargetKey)?.goalId ?? "";
    setLinkTargetKey(firstTarget);
    setLinkGoalId(existingGoalId);
    setLinkSheetOpen(true);
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
    setLinkSheetOpen(false);
  };

  const getCurrentAmountForTarget = (key: string) => {
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
  };

  const selectedCurrentAmount = useMemo(() => getCurrentAmountForTarget(targetKey), [targetKey, props.sacrifice]);

  const previewAmount = useMemo(() => {
    const parsed = Number(amountDraft);
    if (!Number.isFinite(parsed)) return selectedCurrentAmount;
    if (amountMode === "adjust") {
      return selectedCurrentAmount + parsed;
    }
    return parsed;
  }, [amountDraft, amountMode, selectedCurrentAmount]);

  const openAmountSheet = () => {
    const initialTargetKey = targets[0]?.key ?? "monthlySavingsContribution";
    const currentAmount = getCurrentAmountForTarget(initialTargetKey);
    setTargetKey(initialTargetKey);
    setAmountMode("set");
    setAmountDraft(currentAmount.toFixed(2));
    setStartMonth(props.month);
    setStartYear(props.year);
    setPeriod("this_month");
    setAmountSheetOpen(true);
  };

  const selectTarget = (key: string) => {
    setTargetKey(key);
    if (amountMode === "set") {
      const currentAmount = getCurrentAmountForTarget(key);
      setAmountDraft(currentAmount.toFixed(2));
    } else {
      setAmountDraft("0.00");
    }
  };

  const selectAmountMode = (mode: AmountEntryMode) => {
    setAmountMode(mode);
    if (mode === "set") {
      setAmountDraft(selectedCurrentAmount.toFixed(2));
    } else {
      setAmountDraft("0.00");
    }
  };

  const submitAmountSheet = async () => {
    const selected = targets.find((target) => target.key === targetKey);
    const enteredAmount = Number(amountDraft);

    if (!selected) return;
    if (!Number.isFinite(enteredAmount)) return;
    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) return;
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2200) return;

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
      startMonth,
      startYear,
      period,
    });
    setAmountSheetOpen(false);
  };

  const submitAddItemSheet = async () => {
    await props.onCreateItem({
      type: newItemType,
      name: newItemName,
    });
    setNewItemType("custom");
    setNewItemName("");
    setAddItemSheetOpen(false);
  };

  return (
    <>
      <FlatList
        data={[]}
        keyExtractor={(_, idx) => String(idx)}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={T.accent} />}
        ListHeaderComponent={
          props.sacrifice ? (
            <View style={local.wrap}>
              {props.pendingNoticeText ? (
                <View style={local.noticeCard}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={local.noticeTitle}>Reminder</Text>
                    <Text style={local.noticeText}>{props.pendingNoticeText}</Text>
                  </View>
                  {props.onDismissPendingNotice ? (
                    <Pressable onPress={props.onDismissPendingNotice} style={local.noticeCloseBtn}>
                      <Ionicons name="close" size={14} color={T.textDim} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <IncomeSacrificePieChart
                currency={props.currency}
                slices={pieSlices}
                centerTitle={`${MONTH_NAMES_LONG[props.month - 1]} sacrifice`}
              />

              <View style={local.card}>
                <Text style={local.cardTitle}>Manage sacrifices</Text>
                <Text style={local.cardSub}>Set amounts for this month, 6 months, remaining months, or multi-year periods.</Text>

                <View style={local.actionRow}>
                  <Pressable style={[local.primaryBtn, props.sacrificeSaving && local.disabled]} onPress={openAmountSheet} disabled={props.sacrificeSaving}>
                    <Ionicons name="create-outline" size={15} color={T.onAccent} />
                    <Text style={local.primaryBtnText}>Add / edit amount</Text>
                  </Pressable>
                  <Pressable style={[local.secondaryBtn, props.sacrificeCreating && local.disabled]} onPress={() => setAddItemSheetOpen(true)} disabled={props.sacrificeCreating}>
                    <Ionicons name="add" size={15} color={T.text} />
                    <Text style={local.secondaryBtnText}>Add sacrifice item</Text>
                  </Pressable>
                  <Pressable style={[local.secondaryBtn, props.goalLinkSaving && local.disabled]} onPress={openLinkSheet} disabled={props.goalLinkSaving}>
                    <Ionicons name="link-outline" size={15} color={T.text} />
                    <Text style={local.secondaryBtnText}>Link to goal</Text>
                  </Pressable>
                </View>
              </View>

              <View style={local.card}>
                <Text style={local.cardTitle}>Goal confirmations</Text>
                <Text style={local.cardSub}>Confirm transferred sacrifices so linked goals increase.</Text>

                {linkedRows.length === 0 ? (
                  <Text style={local.emptyText}>No linked sacrifices yet. Use “Link to goal” first.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {linkedRows.map((row) => {
                      const isConfirmed = Boolean(row.confirmation);
                      const isBusy = props.confirmingTargetKey === row.targetKey;
                      return (
                        <View key={row.targetKey} style={local.confirmRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={local.confirmTarget}>{row.targetLabel}</Text>
                            <Text style={local.confirmMeta}>
                              Goal: {row.goalTitle} · Planned: {fmt(row.plannedAmount, props.currency)}
                            </Text>
                            <Text style={[local.confirmStatus, isConfirmed && local.confirmStatusOk]}>
                              {isConfirmed ? "Confirmed" : "Pending confirmation"}
                            </Text>
                          </View>
                          <Pressable
                            style={[local.confirmBtn, (isConfirmed || isBusy || row.plannedAmount <= 0) && local.disabled]}
                            onPress={() => props.onConfirmTransfer(row.targetKey)}
                            disabled={isConfirmed || isBusy || row.plannedAmount <= 0}
                          >
                            <Text style={local.confirmBtnText}>{isBusy ? "Saving..." : isConfirmed ? "Done" : "Confirm"}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                {props.sacrifice?.linkedTotals ? (
                  <Text style={local.linkedTotalsText}>
                    Planned {fmt(props.sacrifice.linkedTotals.planned, props.currency)} · Transferred {fmt(props.sacrifice.linkedTotals.transferred, props.currency)} · Pending {fmt(props.sacrifice.linkedTotals.pending, props.currency)}
                  </Text>
                ) : null}
              </View>

            </View>
          ) : (
            <View style={s.center}>
              <ActivityIndicator size="small" color={T.accent} />
            </View>
          )
        }
        ListEmptyComponent={null}
        renderItem={() => null}
      />

      <Modal visible={amountSheetOpen} transparent animationType="slide" onRequestClose={closeAmountSheet}>
        <KeyboardAvoidingView style={local.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={local.sheetBackdrop} onPress={closeAmountSheet} />
          <Animated.View style={[local.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: amountSheetDragY }] }]}>
            <View style={local.sheetHandle} {...amountSheetPanHandlers} />
            <View style={local.sheetHeaderRow}>
              <Text style={local.sheetTitle}>Set sacrifice amount</Text>
              <Pressable style={local.sheetCloseBtn} onPress={closeAmountSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <Text style={local.fieldLabel}>Sacrifice</Text>
              <View style={local.pillWrap}>
                {targets.map((target) => (
                  <Pressable key={target.key} style={[local.pill, target.key === targetKey && local.pillActive]} onPress={() => selectTarget(target.key)}>
                    <Text style={[local.pillText, target.key === targetKey && local.pillTextActive]}>{target.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={local.fieldLabel}>Edit mode</Text>
              <View style={local.pillWrap}>
                <Pressable style={[local.pill, amountMode === "set" && local.pillActive]} onPress={() => selectAmountMode("set")}>
                  <Text style={[local.pillText, amountMode === "set" && local.pillTextActive]}>Set amount</Text>
                </Pressable>
                <Pressable style={[local.pill, amountMode === "adjust" && local.pillActive]} onPress={() => selectAmountMode("adjust")}>
                  <Text style={[local.pillText, amountMode === "adjust" && local.pillTextActive]}>Adjust (+/-)</Text>
                </Pressable>
              </View>

              <Text style={local.currentAmountText}>
                Current: {fmt(selectedCurrentAmount, props.currency)} · New: {fmt(Math.max(0, previewAmount), props.currency)}
              </Text>

              <Text style={local.fieldLabel}>{amountMode === "set" ? `Amount (${props.currency})` : `Adjust by (${props.currency})`}</Text>
              <TextInput
                style={local.input}
                value={amountDraft}
                onChangeText={setAmountDraft}
                keyboardType={amountMode === "adjust" ? "numbers-and-punctuation" : "decimal-pad"}
                placeholder={amountMode === "adjust" ? "0.00 or -10.00" : "0.00"}
                placeholderTextColor={T.textMuted}
              />

              <Pressable style={local.removeAmountBtn} onPress={() => {
                setAmountMode("set");
                setAmountDraft("0.00");
              }}>
                <Text style={local.removeAmountText}>Set to 0 (remove amount)</Text>
              </Pressable>

              <Text style={local.fieldLabel}>Start month</Text>
              <View style={local.monthGrid}>
                {MONTH_CHIPS.map((label, idx) => {
                  const monthValue = idx + 1;
                  const active = startMonth === monthValue;
                  return (
                    <Pressable
                      key={label}
                      style={[local.monthChip, active && local.monthChipActive]}
                      onPress={() => setStartMonth(monthValue)}
                    >
                      <Text style={[local.monthChipText, active && local.monthChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={local.fieldLabel}>Start year</Text>
              <View style={local.yearRow}>
                <Pressable style={local.yearBtn} onPress={() => setStartYear((y) => Math.max(2000, y - 1))}>
                  <Ionicons name="remove" size={16} color={T.text} />
                </Pressable>
                <Text style={local.yearValue}>{startYear}</Text>
                <Pressable style={local.yearBtn} onPress={() => setStartYear((y) => Math.min(2200, y + 1))}>
                  <Ionicons name="add" size={16} color={T.text} />
                </Pressable>
              </View>

              <Text style={local.fieldLabel}>Period</Text>
              <View style={local.pillWrap}>
                {PERIOD_OPTIONS.map((option) => (
                  <Pressable key={option.key} style={[local.pill, option.key === period && local.pillActive]} onPress={() => setPeriod(option.key)}>
                    <Text style={[local.pillText, option.key === period && local.pillTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={[local.primaryBtn, props.sacrificeSaving && local.disabled]} onPress={submitAmountSheet} disabled={props.sacrificeSaving}>
              <Text style={local.primaryBtnText}>{props.sacrificeSaving ? "Saving..." : "Save amount"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addItemSheetOpen} transparent animationType="slide" onRequestClose={closeAddItemSheet}>
        <KeyboardAvoidingView style={local.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={local.sheetBackdrop} onPress={closeAddItemSheet} />
          <Animated.View style={[local.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: addItemSheetDragY }] }]}>
            <View style={local.sheetHandle} {...addItemSheetPanHandlers} />
            <View style={local.sheetHeaderRow}>
              <Text style={local.sheetTitle}>Add sacrifice item</Text>
              <Pressable style={local.sheetCloseBtn} onPress={closeAddItemSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>

            <Text style={local.fieldLabel}>Item type</Text>
            <View style={local.pillWrap}>
              {ADD_ITEM_TYPES.map((type) => (
                <Pressable key={type.key} style={[local.pill, type.key === newItemType && local.pillActive]} onPress={() => setNewItemType(type.key)}>
                  <Text style={[local.pillText, type.key === newItemType && local.pillTextActive]}>{type.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={local.fieldLabel}>Name</Text>
            <TextInput
              style={local.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={newItemType === "custom" ? "Custom item name" : "Optional custom label"}
              placeholderTextColor={T.textMuted}
            />

            <Pressable style={[local.primaryBtn, props.sacrificeCreating && local.disabled]} onPress={submitAddItemSheet} disabled={props.sacrificeCreating}>
              <Text style={local.primaryBtnText}>{props.sacrificeCreating ? "Saving..." : "Create item"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={linkSheetOpen} transparent animationType="slide" onRequestClose={closeLinkSheet}>
        <KeyboardAvoidingView style={local.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={local.sheetBackdrop} onPress={closeLinkSheet} />
          <Animated.View style={[local.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: linkSheetDragY }] }]}>
            <View style={local.sheetHandle} {...linkSheetPanHandlers} />
            <View style={local.sheetHeaderRow}>
              <Text style={local.sheetTitle}>Link sacrifice to goal</Text>
              <Pressable style={local.sheetCloseBtn} onPress={closeLinkSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>

            <Text style={local.fieldLabel}>Sacrifice target</Text>
            <View style={local.pillWrap}>
              {targets.map((target) => (
                <Pressable key={target.key} style={[local.pill, target.key === linkTargetKey && local.pillActive]} onPress={() => selectLinkTarget(target.key)}>
                  <Text style={[local.pillText, target.key === linkTargetKey && local.pillTextActive]}>{target.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={local.fieldLabel}>Goal</Text>
            <View style={local.pillWrap}>
              {(props.sacrifice?.goals ?? []).map((goal) => (
                <Pressable key={goal.id} style={[local.pill, goal.id === linkGoalId && local.pillActive]} onPress={() => setLinkGoalId(goal.id)}>
                  <Text style={[local.pillText, goal.id === linkGoalId && local.pillTextActive]}>{goal.title}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={local.secondaryBtn} onPress={() => setLinkGoalId("")}> 
              <Text style={local.secondaryBtnText}>Unlink from goal</Text>
            </Pressable>

            <Pressable style={[local.primaryBtn, props.goalLinkSaving && local.disabled]} onPress={submitGoalLink} disabled={props.goalLinkSaving}>
              <Text style={local.primaryBtnText}>{props.goalLinkSaving ? "Saving..." : "Save link"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const local = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 14, paddingTop: 22 },
  noticeCard: {
    backgroundColor: `${T.accent}15`,
    borderWidth: 1,
    borderColor: `${T.accent}66`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeTitle: { color: T.text, fontSize: 12, fontWeight: "900" },
  noticeText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  noticeCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  cardTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  cardSub: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  emptyText: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: T.cardAlt,
  },
  confirmTarget: { color: T.text, fontSize: 13, fontWeight: "800" },
  confirmMeta: { color: T.textDim, fontSize: 11, fontWeight: "700" },
  confirmStatus: { color: T.orange, fontSize: 11, fontWeight: "800" },
  confirmStatusOk: { color: T.green },
  confirmBtn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmBtnText: { color: T.onAccent, fontSize: 12, fontWeight: "800" },
  linkedTotalsText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  actionRow: { gap: 8 },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryBtnText: { color: T.onAccent, fontSize: 13, fontWeight: "800" },
  secondaryBtn: {
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryBtnText: { color: T.text, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetCard: {
    backgroundColor: T.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
    height: "100%",
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 999, backgroundColor: T.border },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: T.text, fontSize: 17, fontWeight: "900" },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  fieldLabel: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 9,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  currentAmountText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillActive: { backgroundColor: `${T.accent}22`, borderColor: T.accent },
  pillText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  pillTextActive: { color: T.accent, fontWeight: "800" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingVertical: 7,
  },
  monthChipActive: { borderColor: T.accent, backgroundColor: `${T.accent}22` },
  monthChipText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  monthChipTextActive: { color: T.accent, fontWeight: "800" },
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  yearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  yearValue: { color: T.text, fontSize: 16, fontWeight: "900", minWidth: 74, textAlign: "center" },
  removeAmountBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  removeAmountText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
});
