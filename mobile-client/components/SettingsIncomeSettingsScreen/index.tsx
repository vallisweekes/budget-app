import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "@/components/SettingsIncomeSettingsScreen/style";
import MoneyInput from "@/components/Shared/MoneyInput";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import { INCOME_SOURCE_OPTIONS } from "@/lib/constants";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";
import type { RootStackScreenProps } from "@/navigation/types";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";
import type { IncomeSourceId } from "@/types";

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