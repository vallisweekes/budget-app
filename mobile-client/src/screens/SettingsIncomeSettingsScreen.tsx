import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import MoneyInput from "@/components/Shared/MoneyInput";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import type { RootStackScreenProps } from "@/navigation/types";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";

const INCOME_SOURCE_OPTIONS = [
  {
    id: "salary",
    label: "Salary or wages",
    detail: "Best for users who mainly budget around a regular employer paycheck.",
    icon: "briefcase-outline",
    canonicalName: "Salary",
  },
  {
    id: "business",
    label: "Business income",
    detail: "For owners drawing income from a business, shop, or company profits.",
    icon: "storefront-outline",
    canonicalName: "Business income",
  },
  {
    id: "freelance",
    label: "Freelance or contract",
    detail: "Useful when income lands from client work and timing or amounts can vary.",
    icon: "laptop-outline",
    canonicalName: "Freelance",
  },
  {
    id: "benefits",
    label: "Benefits or pension",
    detail: "For users whose main monthly support is government, pension, or assistance income.",
    icon: "shield-checkmark-outline",
    canonicalName: "Benefits",
  },
  {
    id: "investments",
    label: "Rental or investment income",
    detail: "For income driven mostly by rent, dividends, or other asset-based payments.",
    icon: "trending-up-outline",
    canonicalName: "Investment income",
  },
  {
    id: "mixed",
    label: "Mixed income",
    detail: "Best when no single source clearly dominates and budgeting needs to stay flexible.",
    icon: "git-merge-outline",
    canonicalName: "Mixed income",
  },
] as const;

type IncomeSourceId = (typeof INCOME_SOURCE_OPTIONS)[number]["id"];

function detectIncomeSourceId(name: string | null | undefined): IncomeSourceId {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized || normalized === "salary" || normalized.includes("wage") || normalized.includes("paycheck")) return "salary";
  if (normalized.includes("business") || normalized.includes("shop") || normalized.includes("profit")) return "business";
  if (normalized.includes("freelance") || normalized.includes("contract") || normalized.includes("client")) return "freelance";
  if (normalized.includes("benefit") || normalized.includes("pension") || normalized.includes("assistance")) return "benefits";
  if (normalized.includes("rent") || normalized.includes("dividend") || normalized.includes("investment")) return "investments";
  return "mixed";
}

export default function SettingsIncomeSettingsScreen({ navigation }: RootStackScreenProps<"SettingsIncomeSettings">) {
  const topHeaderOffset = useTopHeaderOffset(8);
  const { settings } = useBootstrapData();
  const onboardingQuery = useGetOnboardingStatusQuery();
  const [updateOnboardingProfile] = useUpdateOnboardingProfileMutation();
  const [selectedSource, setSelectedSource] = useState<IncomeSourceId>("salary");
  const [analysis, setAnalysis] = useState<IncomeMonthData | null>(null);
  const [primaryIncomeName, setPrimaryIncomeName] = useState("Salary");
  const [primaryIncomeAmount, setPrimaryIncomeAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyFullYear, setApplyFullYear] = useState(Boolean(settings?.incomeDistributeFullYearDefault));
  const [applyHorizon, setApplyHorizon] = useState(Boolean(settings?.incomeDistributeHorizonDefault));

  const budgetPlanId = settings?.id ?? null;
  const currency = currencySymbol(settings?.currency);

  useEffect(() => {
    setApplyFullYear(Boolean(settings?.incomeDistributeFullYearDefault));
  }, [settings?.incomeDistributeFullYearDefault]);

  useEffect(() => {
    setApplyHorizon(Boolean(settings?.incomeDistributeHorizonDefault));
  }, [settings?.incomeDistributeHorizonDefault]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!budgetPlanId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const now = new Date();
        const nextAnalysis = await apiFetch<IncomeMonthData>(
          `/api/bff/income-month?month=${now.getMonth() + 1}&year=${now.getFullYear()}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`,
          { cacheTtlMs: 0 }
        );
        if (cancelled) return;

        setAnalysis(nextAnalysis);
        const salaryItem = nextAnalysis.incomeItems.find((item) => String(item.name ?? "").trim().toLowerCase() === "salary");
        const primaryItem = salaryItem
          ?? [...nextAnalysis.incomeItems].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))[0]
          ?? null;
        const fallbackSalary = Number(onboardingQuery.data?.profile?.monthlySalary ?? 0);
        const nextName = primaryItem?.name ?? "Salary";
        const nextAmount = primaryItem?.amount != null ? String(primaryItem.amount) : (fallbackSalary > 0 ? String(fallbackSalary) : "");

        setPrimaryIncomeName(nextName);
        setPrimaryIncomeAmount(nextAmount);
        setSelectedSource(detectIncomeSourceId(nextName));
      } catch {
        if (cancelled) return;
        const fallbackSalary = Number(onboardingQuery.data?.profile?.monthlySalary ?? 0);
        setPrimaryIncomeName("Salary");
        setPrimaryIncomeAmount(fallbackSalary > 0 ? String(fallbackSalary) : "");
        setSelectedSource("salary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [budgetPlanId, onboardingQuery.data?.profile?.monthlySalary]);

  const activeSource = useMemo(
    () => INCOME_SOURCE_OPTIONS.find((option) => option.id === selectedSource) ?? INCOME_SOURCE_OPTIONS[0],
    [selectedSource]
  );

  const detectedSourceCount = analysis?.sourceCount ?? 0;
  const numericPrimaryIncomeAmount = Number(String(primaryIncomeAmount).replace(/,/g, ""));
  const baselineSource = useMemo(() => detectIncomeSourceId(primaryIncomeName), [primaryIncomeName]);
  const isDirty = useMemo(() => {
    const initialAmount = analysis?.incomeItems.find((item) => String(item.name ?? "").trim().toLowerCase() === String(primaryIncomeName).trim().toLowerCase())?.amount;
    const onboardingSalary = Number(onboardingQuery.data?.profile?.monthlySalary ?? 0);
    const baselineAmount = initialAmount ?? (selectedSource === "salary" ? onboardingSalary : 0);
    const nextAmount = Number.isFinite(numericPrimaryIncomeAmount) ? numericPrimaryIncomeAmount : 0;
    return (
      selectedSource !== baselineSource
      || Number(baselineAmount ?? 0) !== nextAmount
      || applyFullYear !== Boolean(settings?.incomeDistributeFullYearDefault)
      || applyHorizon !== Boolean(settings?.incomeDistributeHorizonDefault)
    );
  }, [analysis?.incomeItems, applyFullYear, applyHorizon, baselineSource, numericPrimaryIncomeAmount, onboardingQuery.data?.profile?.monthlySalary, primaryIncomeName, selectedSource, settings?.incomeDistributeFullYearDefault, settings?.incomeDistributeHorizonDefault]);

  const save = async () => {
    if (!budgetPlanId) {
      Alert.alert("Missing budget plan", "Please try again after the app reloads.");
      return;
    }

    if (!Number.isFinite(numericPrimaryIncomeAmount) || numericPrimaryIncomeAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid primary income amount.");
      return;
    }

    const now = new Date();
    const nextName = selectedSource === "salary" ? "Salary" : (primaryIncomeName.trim() || activeSource.canonicalName);

    try {
      setSaving(true);
      await apiFetch("/api/bff/income", {
        method: "POST",
        body: {
          name: nextName,
          amount: numericPrimaryIncomeAmount,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          budgetPlanId,
          distributeFullYear: applyFullYear,
          distributeHorizon: applyHorizon,
        },
      });

      if (selectedSource === "salary") {
        await updateOnboardingProfile({ monthlySalary: numericPrimaryIncomeAmount }).unwrap();
      }

      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save income settings", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const currentSummaryText = numericPrimaryIncomeAmount > 0
    ? `${fmt(numericPrimaryIncomeAmount, currency)} per period`
    : "No primary amount set yet";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Income settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Primary income</Text>
          <Text style={styles.heroTitle}>Manage the income source your plan should follow first.</Text>
          <Text style={styles.heroText}>
            Changes here update the main income amount and can push that change through the remaining periods in the plan.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Current primary income</Text>
          <Text style={styles.previewTitle}>{activeSource.label}</Text>
          <Text style={styles.previewAmount}>{currentSummaryText}</Text>
          <Text style={styles.previewText}>
            {detectedSourceCount > 1
              ? `Detected from ${detectedSourceCount} income sources in the current period. Salary is selected first when it exists.`
              : "Detected from the current income setup for this plan."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary income source</Text>
          {INCOME_SOURCE_OPTIONS.map((option) => {
            const active = option.id === selectedSource;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setSelectedSource(option.id);
                  if (option.id === "salary") {
                    setPrimaryIncomeName("Salary");
                    return;
                  }
                  if (!primaryIncomeName.trim() || primaryIncomeName.trim() === "Salary") {
                    setPrimaryIncomeName(option.canonicalName);
                  }
                }}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <View style={[styles.optionIconWrap, active && styles.optionIconWrapActive]}>
                  <Ionicons name={option.icon} size={18} color={active ? T.accent : T.textDim} />
                </View>
                <View style={styles.optionBody}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={18} color={T.accent} /> : null}
                  </View>
                  <Text style={styles.optionDetail}>{option.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.editorCard}>
          <Text style={styles.editorTitle}>Primary income amount</Text>
          <Text style={styles.editorText}>
            {selectedSource === "salary"
              ? "Salary is kept as the primary income row here, so salary updates will carry across future periods when the switches below are on."
              : "Use this amount for the selected primary source. The update will use that same source name when it is distributed forward."}
          </Text>

          <MoneyInput
            currency={settings?.currency ?? "GBP"}
            value={primaryIncomeAmount}
            onChangeValue={setPrimaryIncomeAmount}
            variant="light"
            placeholder="0.00"
          />

          <View style={styles.switchCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Update remaining periods this year</Text>
                <Text style={styles.switchHint}>Apply the new amount from this period through the rest of the year.</Text>
              </View>
              <Switch
                value={applyFullYear}
                onValueChange={setApplyFullYear}
                trackColor={{ false: T.border, true: T.accentFaint }}
                thumbColor={applyFullYear ? T.accent : T.card}
              />
            </View>

            <View style={styles.switchDivider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Keep that amount across the plan horizon</Text>
                <Text style={styles.switchHint}>Future periods after this year will carry the updated primary income too.</Text>
              </View>
              <Switch
                value={applyHorizon}
                onValueChange={setApplyHorizon}
                trackColor={{ false: T.border, true: T.accentFaint }}
                thumbColor={applyHorizon ? T.accent : T.card}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, (!isDirty || saving || loading) && styles.disabled]} onPress={save} disabled={!isDirty || saving || loading}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "800" },
  headerSpacer: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 14 },
  heroCard: {
    ...cardElevated,
    padding: 18,
    gap: 8,
  },
  eyebrow: { color: T.accent, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  heroTitle: { color: T.text, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  heroText: { color: T.textDim, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  section: { gap: 10 },
  sectionTitle: { color: T.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
  optionCard: {
    ...cardBase,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  optionCardActive: {
    borderColor: T.accent,
    backgroundColor: T.accentDim,
  },
  optionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  optionIconWrapActive: {
    backgroundColor: T.card,
    borderColor: `${T.accent}66`,
  },
  optionBody: { flex: 1, gap: 4 },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  optionTitleActive: { color: T.accent },
  optionDetail: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  previewCard: {
    ...cardElevated,
    padding: 16,
    gap: 6,
  },
  previewLabel: { color: T.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  previewTitle: { color: T.text, fontSize: 17, fontWeight: "900" },
  previewAmount: { color: T.accent, fontSize: 16, fontWeight: "900" },
  previewText: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  editorCard: {
    ...cardElevated,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  editorTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  editorText: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  switchCard: { ...cardBase, paddingHorizontal: 14, paddingVertical: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  switchTextWrap: { flex: 1, gap: 3 },
  switchTitle: { color: T.text, fontSize: 14, fontWeight: "800" },
  switchHint: { color: T.textDim, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  switchDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  footer: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: `${T.bg}F2`,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.card,
  },
  cancelBtnText: { color: T.textMuted, fontSize: 14, fontWeight: "800" },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.accent,
  },
  saveBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});