import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./styles";

import type { IncomeSacrificeData } from "@/lib/apiTypes";
import { fmt, MONTH_NAMES_LONG } from "@/lib/formatting";
import { useSwipeDownToClose } from "@/hooks";
import { T } from "@/lib/theme";
import { s } from "@/components/IncomeMonthScreen/style";
import IncomeSacrificePieChart from "@/components/Income/IncomeSacrificePieChart";
import MoneyInput from "@/components/Shared/MoneyInput";
import type {
  AmountEntryMode,
  IncomeMonthSacrificeListProps,
  IncomeSacrificeItemType,
  SacrificePeriod,
  TargetOption,
} from "@/types";

const PERIOD_OPTIONS: Array<{ key: SacrificePeriod; label: string }> = [
  { key: "this_month", label: "This month" },
  { key: "next_six_months", label: "Next 6 months" },
  { key: "remaining_months", label: "Remaining months" },
  { key: "two_years", label: "2 years" },
  { key: "five_years", label: "5 years" },
  { key: "ten_years", label: "10 years" },
];

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

export default function IncomeMonthSacrificeList(props: IncomeMonthSacrificeListProps) {
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

  const [newItemType, setNewItemType] = useState<IncomeSacrificeItemType>("custom");
  const [newItemName, setNewItemName] = useState("");
  const [linkTargetKey, setLinkTargetKey] = useState("");
  const [linkGoalId, setLinkGoalId] = useState<string>("");
  const canManage = props.canManage ?? true;

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
    if (!canManage) return;
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
    if (!canManage) return;
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
            <View style={styles.wrap}>
              {props.pendingNoticeText ? (
                <View style={styles.noticeCard}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.noticeTitle}>Reminder</Text>
                    <Text style={styles.noticeText}>{props.pendingNoticeText}</Text>
                  </View>
                  {props.onDismissPendingNotice ? (
                    <Pressable onPress={props.onDismissPendingNotice} style={styles.noticeCloseBtn}>
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

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Manage sacrifices</Text>
                <Text style={styles.cardSub}>
                  {canManage
                    ? "Set amounts for this month, 6 months, remaining months, or multi-year periods."
                    : (props.manageUnavailableReason ?? "Manage sacrifice is no longer available for this period.")}
                </Text>

                {canManage ? (
                  <View style={styles.actionRow}>
                    <Pressable style={[styles.primaryBtn, props.sacrificeSaving && styles.disabled]} onPress={openAmountSheet} disabled={props.sacrificeSaving}>
                      <Ionicons name="create-outline" size={15} color={T.onAccent} />
                      <Text style={styles.primaryBtnText}>Add / edit amount</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryBtn, props.sacrificeCreating && styles.disabled]} onPress={() => setAddItemSheetOpen(true)} disabled={props.sacrificeCreating}>
                      <Ionicons name="add" size={15} color={T.text} />
                      <Text style={styles.secondaryBtnText}>Add sacrifice item</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryBtn, props.goalLinkSaving && styles.disabled]} onPress={openLinkSheet} disabled={props.goalLinkSaving}>
                      <Ionicons name="link-outline" size={15} color={T.text} />
                      <Text style={styles.secondaryBtnText}>Link to goal</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Goal confirmations</Text>
                <Text style={styles.cardSub}>Confirm transferred sacrifices so linked goals increase.</Text>

                {linkedRows.length === 0 ? (
                  <Text style={styles.emptyText}>No linked sacrifices yet. Use “Link to goal” first.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {linkedRows.map((row) => {
                      const isConfirmed = Boolean(row.confirmation);
                      const isBusy = props.confirmingTargetKey === row.targetKey;
                      return (
                        <View key={row.targetKey} style={styles.confirmRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.confirmTarget}>{row.targetLabel}</Text>
                            <Text style={styles.confirmMeta}>
                              Goal: {row.goalTitle} · Planned: {fmt(row.plannedAmount, props.currency)}
                            </Text>
                            <Text style={[styles.confirmStatus, isConfirmed && styles.confirmStatusOk]}>
                              {isConfirmed ? "Confirmed" : "Pending confirmation"}
                            </Text>
                          </View>
                          <Pressable
                            style={[styles.confirmBtn, (!canManage || isConfirmed || isBusy || row.plannedAmount <= 0) && styles.disabled]}
                            onPress={() => props.onConfirmTransfer(row.targetKey)}
                            disabled={!canManage || isConfirmed || isBusy || row.plannedAmount <= 0}
                          >
                            <Text style={styles.confirmBtnText}>{isBusy ? "Saving..." : isConfirmed ? "Done" : "Confirm"}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                {props.sacrifice?.linkedTotals ? (
                  <Text style={styles.linkedTotalsText}>
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

      <Modal visible={canManage && amountSheetOpen} transparent animationType="slide" onRequestClose={closeAmountSheet}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={closeAmountSheet} />
          <Animated.View style={[styles.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: amountSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...amountSheetPanHandlers} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Set sacrifice amount</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={closeAmountSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <Text style={styles.fieldLabel}>Sacrifice</Text>
              <View style={styles.pillWrap}>
                {targets.map((target) => (
                  <Pressable key={target.key} style={[styles.pill, target.key === targetKey && styles.pillActive]} onPress={() => selectTarget(target.key)}>
                    <Text style={[styles.pillText, target.key === targetKey && styles.pillTextActive]}>{target.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Edit mode</Text>
              <View style={styles.pillWrap}>
                <Pressable style={[styles.pill, amountMode === "set" && styles.pillActive]} onPress={() => selectAmountMode("set")}>
                  <Text style={[styles.pillText, amountMode === "set" && styles.pillTextActive]}>Set amount</Text>
                </Pressable>
                <Pressable style={[styles.pill, amountMode === "adjust" && styles.pillActive]} onPress={() => selectAmountMode("adjust")}>
                  <Text style={[styles.pillText, amountMode === "adjust" && styles.pillTextActive]}>Adjust (+/-)</Text>
                </Pressable>
              </View>

              <Text style={styles.currentAmountText}>
                Current: {fmt(selectedCurrentAmount, props.currency)} · New: {fmt(Math.max(0, previewAmount), props.currency)}
              </Text>

              <Text style={styles.fieldLabel}>{amountMode === "set" ? `Amount (${props.currency})` : `Adjust by (${props.currency})`}</Text>
              <MoneyInput
                currency={props.currency}
                value={amountDraft}
                onChangeValue={setAmountDraft}
                keyboardType={amountMode === "adjust" ? "numbers-and-punctuation" : "decimal-pad"}
                placeholder={amountMode === "adjust" ? "0.00 or -10.00" : "0.00"}
                placeholderTextColor={T.textMuted}
                containerStyle={styles.input}
              />

              <Pressable style={styles.removeAmountBtn} onPress={() => {
                setAmountMode("set");
                setAmountDraft("0.00");
              }}>
                <Text style={styles.removeAmountText}>Set to 0 (remove amount)</Text>
              </Pressable>

              <Text style={styles.fieldLabel}>Start month</Text>
              <View style={styles.monthGrid}>
                {MONTH_CHIPS.map((label, idx) => {
                  const monthValue = idx + 1;
                  const active = startMonth === monthValue;
                  return (
                    <Pressable
                      key={label}
                      style={[styles.monthChip, active && styles.monthChipActive]}
                      onPress={() => setStartMonth(monthValue)}
                    >
                      <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Start year</Text>
              <View style={styles.yearRow}>
                <Pressable style={styles.yearBtn} onPress={() => setStartYear((y) => Math.max(2000, y - 1))}>
                  <Ionicons name="remove" size={16} color={T.text} />
                </Pressable>
                <Text style={styles.yearValue}>{startYear}</Text>
                <Pressable style={styles.yearBtn} onPress={() => setStartYear((y) => Math.min(2200, y + 1))}>
                  <Ionicons name="add" size={16} color={T.text} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Period</Text>
              <View style={styles.pillWrap}>
                {PERIOD_OPTIONS.map((option) => (
                  <Pressable key={option.key} style={[styles.pill, option.key === period && styles.pillActive]} onPress={() => setPeriod(option.key)}>
                    <Text style={[styles.pillText, option.key === period && styles.pillTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={[styles.primaryBtn, props.sacrificeSaving && styles.disabled]} onPress={submitAmountSheet} disabled={props.sacrificeSaving}>
              <Text style={styles.primaryBtnText}>{props.sacrificeSaving ? "Saving..." : "Save amount"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={canManage && addItemSheetOpen} transparent animationType="slide" onRequestClose={closeAddItemSheet}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={closeAddItemSheet} />
          <Animated.View style={[styles.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: addItemSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...addItemSheetPanHandlers} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Add sacrifice item</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={closeAddItemSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Item type</Text>
            <View style={styles.pillWrap}>
              {ADD_ITEM_TYPES.map((type) => (
                <Pressable key={type.key} style={[styles.pill, type.key === newItemType && styles.pillActive]} onPress={() => setNewItemType(type.key)}>
                  <Text style={[styles.pillText, type.key === newItemType && styles.pillTextActive]}>{type.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={newItemType === "custom" ? "Custom item name" : "Optional custom label"}
              placeholderTextColor={T.textMuted}
            />

            <Pressable style={[styles.primaryBtn, props.sacrificeCreating && styles.disabled]} onPress={submitAddItemSheet} disabled={props.sacrificeCreating}>
              <Text style={styles.primaryBtnText}>{props.sacrificeCreating ? "Saving..." : "Create item"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={canManage && linkSheetOpen} transparent animationType="slide" onRequestClose={closeLinkSheet}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={closeLinkSheet} />
          <Animated.View style={[styles.sheetCard, { paddingTop: Math.max(14, insets.top + 8), transform: [{ translateY: linkSheetDragY }] }]}>
            <View style={styles.sheetHandle} {...linkSheetPanHandlers} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Link sacrifice to goal</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={closeLinkSheet}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Sacrifice target</Text>
            <View style={styles.pillWrap}>
              {targets.map((target) => (
                <Pressable key={target.key} style={[styles.pill, target.key === linkTargetKey && styles.pillActive]} onPress={() => selectLinkTarget(target.key)}>
                  <Text style={[styles.pillText, target.key === linkTargetKey && styles.pillTextActive]}>{target.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Goal</Text>
            <View style={styles.pillWrap}>
              {(props.sacrifice?.goals ?? []).map((goal) => (
                <Pressable key={goal.id} style={[styles.pill, goal.id === linkGoalId && styles.pillActive]} onPress={() => setLinkGoalId(goal.id)}>
                  <Text style={[styles.pillText, goal.id === linkGoalId && styles.pillTextActive]}>{goal.title}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.secondaryBtn} onPress={() => setLinkGoalId("")}> 
              <Text style={styles.secondaryBtnText}>Unlink from goal</Text>
            </Pressable>

            <Pressable style={[styles.primaryBtn, props.goalLinkSaving && styles.disabled]} onPress={submitGoalLink} disabled={props.goalLinkSaving}>
              <Text style={styles.primaryBtnText}>{props.goalLinkSaving ? "Saving..." : "Save link"}</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
