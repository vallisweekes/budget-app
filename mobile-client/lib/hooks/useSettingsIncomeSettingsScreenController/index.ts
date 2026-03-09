import { Alert } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { INCOME_SOURCE_OPTIONS } from "@/lib/constants";
import { currencySymbol, fmt } from "@/lib/formatting";
import type { RootStackScreenProps } from "@/navigation/types";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";
import type { IncomeSourceId } from "@/types";
import { useTopHeaderOffset } from "@/hooks";

function detectIncomeSourceId(name: string | null | undefined): IncomeSourceId {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized || normalized === "salary" || normalized.includes("wage") || normalized.includes("paycheck")) return "salary";
  if (normalized.includes("business") || normalized.includes("shop") || normalized.includes("profit")) return "business";
  if (normalized.includes("freelance") || normalized.includes("contract") || normalized.includes("client")) return "freelance";
  if (normalized.includes("benefit") || normalized.includes("pension") || normalized.includes("assistance")) return "benefits";
  if (normalized.includes("rent") || normalized.includes("dividend") || normalized.includes("investment")) return "investments";
  return "mixed";
}

type SettingsIncomeSettingsNavigation = RootStackScreenProps<"SettingsIncomeSettings">["navigation"];

export function useSettingsIncomeSettingsScreenController(navigation: SettingsIncomeSettingsNavigation) {
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
          { cacheTtlMs: 0 },
        );
        if (cancelled) return;

        setAnalysis(nextAnalysis);
        const salaryItem = nextAnalysis.incomeItems.find((item) => String(item.name ?? "").trim().toLowerCase() === "salary");
        const primaryItem = salaryItem
          ?? [...nextAnalysis.incomeItems].sort((left, right) => Number(right.amount ?? 0) - Number(left.amount ?? 0))[0]
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
    [selectedSource],
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

  const currentSummaryText = numericPrimaryIncomeAmount > 0
    ? `${fmt(numericPrimaryIncomeAmount, currency)} per period`
    : "No primary amount set yet";

  const selectSource = useCallback((sourceId: IncomeSourceId) => {
    setSelectedSource(sourceId);
    const option = INCOME_SOURCE_OPTIONS.find((item) => item.id === sourceId);

    if (sourceId === "salary") {
      setPrimaryIncomeName("Salary");
      return;
    }

    if (!option) return;
    if (!primaryIncomeName.trim() || primaryIncomeName.trim() === "Salary") {
      setPrimaryIncomeName(option.canonicalName);
    }
  }, [primaryIncomeName]);

  const save = useCallback(async () => {
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
  }, [activeSource.canonicalName, applyFullYear, applyHorizon, budgetPlanId, navigation, numericPrimaryIncomeAmount, primaryIncomeName, selectedSource, updateOnboardingProfile]);

  return {
    activeSource,
    applyFullYear,
    applyHorizon,
    currentSummaryText,
    detectedSourceCount,
    loading,
    primaryIncomeAmount,
    saving,
    selectedSource,
    settings,
    topHeaderOffset,
    isDirty,
    goBack: () => navigation.goBack(),
    save,
    selectSource,
    setApplyFullYear,
    setApplyHorizon,
    setPrimaryIncomeAmount,
  };
}