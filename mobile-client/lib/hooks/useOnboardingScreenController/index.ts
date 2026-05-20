import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { OnboardingProfile } from "@/lib/apiTypes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, LayoutAnimation, PanResponder, Platform, UIManager } from "react-native";
import { Sacramento_400Regular } from "@expo-google-fonts/sacramento";
import { useFonts } from "expo-font";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OnboardingScreenProps, VisibleGoal } from "@/types/OnboardingScreen.types";
import { buildInitialGoals, isPositiveNumber } from "@/components/OnboardingScreen/utils";
import { COMMON_OCCUPATIONS, OCCUPATION_INCOME_SOURCE_OPTIONS } from "@/lib/constants";

type Frequency = "monthly" | "every_2_weeks" | "every_4_weeks" | "weekly" | null;

function parseDateOnly(value: string | null | undefined): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function sanitizePayDayInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
  if (!digits) return "";
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(31, parsed));
}

function getIncomeSourceOptionsForOccupation(value: string): string[] {
  const normalized = value.trim().toLowerCase();
  const options = (OCCUPATION_INCOME_SOURCE_OPTIONS as Record<string, readonly string[]>)[normalized];
  return options ? [...options] : [];
}

function occupationRequiresIncomeSource(value: string): boolean {
  return getIncomeSourceOptionsForOccupation(value).length > 0;
}

function buildPayload(state: {
  allowanceAmount: string;
  debtAmount: string;
  debtNotes: string;
  expenseFourAmount: string;
  expenseFourName: string;
  expenseOneAmount: string;
  expenseOneName: string;
  expenseThreeAmount: string;
  expenseThreeName: string;
  expenseTwoAmount: string;
  expenseTwoName: string;
  hasAllowance: boolean | null;
  hasDebts: boolean | null;
  mainGoals: VisibleGoal[];
  occupation: string;
  occupationOther: string;
  payDay: string;
  payAnchorDate: string | null;
  payFrequency: Frequency;
  planningYears: string;
  salary: string;
  savingsGoalAmount: string;
  savingsGoalYear: string;
}): Partial<OnboardingProfile> {
  const parsedPayAnchorDate = parseDateOnly(state.payAnchorDate);
  const resolvedPayFrequency = state.payFrequency ?? undefined;
  const resolvedPayDay = resolvedPayFrequency === "monthly"
    ? (state.payDay ? Math.max(1, Math.min(31, Number(state.payDay))) : null)
    : parsedPayAnchorDate
      ? parsedPayAnchorDate.getDate()
      : null;

  return {
    allowanceAmount: state.hasAllowance === true && state.allowanceAmount ? Number(state.allowanceAmount) : null,
    debtAmount: state.hasDebts === true && state.debtAmount ? Number(state.debtAmount) : null,
    debtNotes: state.debtNotes,
    expenseFourAmount: state.expenseFourAmount ? Number(state.expenseFourAmount) : null,
    expenseFourName: state.expenseFourName,
    expenseOneAmount: state.expenseOneAmount ? Number(state.expenseOneAmount) : null,
    expenseOneName: state.expenseOneName,
    expenseThreeAmount: state.expenseThreeAmount ? Number(state.expenseThreeAmount) : null,
    expenseThreeName: state.expenseThreeName,
    expenseTwoAmount: state.expenseTwoAmount ? Number(state.expenseTwoAmount) : null,
    expenseTwoName: state.expenseTwoName,
    hasAllowance: state.hasAllowance ?? undefined,
    hasDebtsToManage: state.hasDebts ?? undefined,
    mainGoal: state.mainGoals[0] ?? null,
    mainGoals: state.mainGoals,
    monthlySalary: state.salary ? Number(state.salary) : null,
    occupation: state.occupation,
    occupationOther: state.occupationOther,
    payDay: resolvedPayDay,
    payAnchorDate: resolvedPayFrequency === "monthly" ? null : (parsedPayAnchorDate ? formatDateOnly(parsedPayAnchorDate) : null),
    payFrequency: resolvedPayFrequency,
    planningYears: state.planningYears ? Number(state.planningYears) : null,
    savingsGoalAmount: state.savingsGoalAmount ? Number(state.savingsGoalAmount) : null,
    savingsGoalYear: state.savingsGoalYear ? Number(state.savingsGoalYear) : null,
  };
}

function validateStep(params: {
  allowanceAmount: string;
  debtAmount: string;
  debtNotes: string;
  expenseFourAmount: string;
  expenseFourName: string;
  expenseOneAmount: string;
  expenseOneName: string;
  expenseThreeAmount: string;
  expenseThreeName: string;
  expenseTwoAmount: string;
  expenseTwoName: string;
  hasAllowance: boolean | null;
  hasDebts: boolean | null;
  mainGoals: VisibleGoal[];
  occupation: string;
  occupationOther: string;
  incomeSource: string;
  incomeSourceOther: string;
  payAnchorDate: string | null;
  payDayNumber: number | null;
  payFrequency: Frequency;
  planningYears: string;
  salary: string;
  savingsGoalAmount: string;
  savingsGoalYear: string;
  step: number;
}): string | null {
  const {
    allowanceAmount,
    debtAmount,
    debtNotes,
    expenseFourAmount,
    expenseFourName,
    expenseOneAmount,
    expenseOneName,
    expenseThreeAmount,
    expenseThreeName,
    expenseTwoAmount,
    expenseTwoName,
    hasAllowance,
    hasDebts,
    mainGoals,
    occupation,
    occupationOther,
    incomeSource,
    incomeSourceOther,
    payAnchorDate,
    payDayNumber,
    payFrequency,
    planningYears,
    salary,
    savingsGoalAmount,
    savingsGoalYear,
    step,
  } = params;

  if (step === 0 && mainGoals.length === 0) {
    return "Please choose at least one goal to continue.";
  }

  if (step === 1) {
    const normalizedOccupation = occupation.trim();
    if (!normalizedOccupation) return "Please select your occupation.";
    if (normalizedOccupation.toLowerCase() === "other" && !occupationOther.trim()) {
      return "Please enter your occupation.";
    }

    if (occupationRequiresIncomeSource(normalizedOccupation)) {
      if (!incomeSource.trim()) return "Please choose your source of income.";
      if (incomeSource.trim().toLowerCase() === "other" && !incomeSourceOther.trim()) {
        return "Please enter your source of income.";
      }
    }
  }

  if (step === 2) {
    if (!payFrequency) return "Please choose how often you get paid.";
    if (payFrequency === "monthly" && !payDayNumber) return "Please enter the day of the month you get paid.";
    if (payFrequency !== "monthly" && !parseDateOnly(payAnchorDate)) {
      return "Please choose the last date or next date you get paid.";
    }
    if (!isPositiveNumber(salary)) {
      return occupationRequiresIncomeSource(occupation)
        ? "Please enter how much you receive each month to continue."
        : "Please enter your monthly take-home pay (after tax) to continue.";
    }
    const years = Number(planningYears);
    if (!Number.isInteger(years) || years < 1 || years > 30) {
      return "Please choose how far ahead you want to plan.";
    }
  }

  if (step === 3) {
    const hasAllBillNames =
      expenseOneName.trim().length > 0 &&
      expenseTwoName.trim().length > 0 &&
      expenseThreeName.trim().length > 0 &&
      expenseFourName.trim().length > 0;
    const hasAllBillAmounts =
      isPositiveNumber(expenseOneAmount) &&
      isPositiveNumber(expenseTwoAmount) &&
      isPositiveNumber(expenseThreeAmount) &&
      isPositiveNumber(expenseFourAmount);
    if (!hasAllBillNames) return "Please add a name for each monthly bill.";
    if (!hasAllBillAmounts) return "Please add an amount for each monthly bill.";
  }

  if (step === 4) {
    if (hasAllowance === null) return "Please choose Yes or No for spending money.";
    if (hasAllowance === true && !isPositiveNumber(allowanceAmount)) {
      return "Please enter your spending money amount.";
    }
  }

  if (step === 5) {
    if (hasDebts === null) return "Please choose Yes or No for debts.";
    if (hasDebts === true && !isPositiveNumber(debtAmount)) {
      return "Please enter your debt amount.";
    }
    if (hasDebts === true && debtNotes.trim().length === 0) {
      return "Please enter a debt name.";
    }
    const isSavingsFocus = mainGoals.includes("improve_savings");
    const goalAmount = Number(savingsGoalAmount);
    const goalYear = Number(savingsGoalYear);
    const currentYear = new Date().getFullYear();
    if (isSavingsFocus && !(Number.isFinite(goalAmount) && goalAmount > 0)) {
      return "Please enter a savings goal amount so we can build your projection.";
    }
    if (isSavingsFocus && !(Number.isInteger(goalYear) && goalYear >= currentYear && goalYear <= currentYear + 30)) {
      return "Please enter a valid savings target year.";
    }
    if (savingsGoalYear.trim().length > 0 && !(Number.isInteger(goalYear) && goalYear >= 2000 && goalYear <= 2200)) {
      return "Please enter a valid year for your savings goal.";
    }
  }

  return null;
}

export function useOnboardingScreenController({ initial, onCompleted }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Sacramento_400Regular });
  const { completeRegistration, pendingRegistration, signOut, token, updatePendingRegistrationProfile, username } = useAuth();
  const profile = initial.profile;
  const currency = "GBP";

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mainGoals, setMainGoals] = useState<VisibleGoal[]>(() => buildInitialGoals(profile));
  const initialOccupation = profile?.occupation ?? "";
  const initialOccupationOther = profile?.occupationOther ?? "";
  const initialIncomeSourceOptions = getIncomeSourceOptionsForOccupation(initialOccupation);
  const [occupation, setOccupation] = useState(initialOccupation);
  const [occupationOther, setOccupationOther] = useState(
    initialOccupation.trim().toLowerCase() === "other" ? initialOccupationOther : ""
  );
  const [incomeSource, setIncomeSource] = useState(() => {
    if (!initialIncomeSourceOptions.length) return "";
    const stored = initialOccupationOther.trim();
    if (!stored) return "";
    const matched = initialIncomeSourceOptions.find((item) => item.toLowerCase() === stored.toLowerCase());
    return matched ?? "Other";
  });
  const [incomeSourceOther, setIncomeSourceOther] = useState(() => {
    if (!initialIncomeSourceOptions.length) return "";
    const stored = initialOccupationOther.trim();
    if (!stored) return "";
    const matched = initialIncomeSourceOptions.some((item) => item.toLowerCase() === stored.toLowerCase());
    return matched ? "" : initialOccupationOther;
  });
  const [payDay, setPayDay] = useState(() => sanitizePayDayInput(String(profile?.payDay ?? "")));
  const [payAnchorDate, setPayAnchorDate] = useState<string | null>(() => {
    const parsed = parseDateOnly(typeof profile?.payAnchorDate === "string" ? profile.payAnchorDate : null);
    return parsed ? formatDateOnly(parsed) : null;
  });
  const [payFrequency, setPayFrequency] = useState<Frequency>(
    profile?.payFrequency === "weekly" ||
      profile?.payFrequency === "every_2_weeks" ||
      profile?.payFrequency === "every_4_weeks" ||
      profile?.payFrequency === "monthly"
      ? profile.payFrequency
      : null,
  );
  const [salary, setSalary] = useState(String(profile?.monthlySalary ?? ""));
  const [planningYears, setPlanningYears] = useState<string>(() => {
    const raw = Number(profile?.planningYears ?? 0);
    if (!Number.isFinite(raw) || raw < 1) return "10";
    return String(Math.min(30, Math.trunc(raw)));
  });
  const [savingsGoalAmount, setSavingsGoalAmount] = useState(String(profile?.savingsGoalAmount ?? ""));
  const [savingsGoalYear, setSavingsGoalYear] = useState(String(profile?.savingsGoalYear ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(profile?.expenseOneName ?? "");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(profile?.expenseTwoName ?? "");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(profile?.expenseTwoAmount ?? ""));
  const [expenseThreeName, setExpenseThreeName] = useState(profile?.expenseThreeName ?? "");
  const [expenseThreeAmount, setExpenseThreeAmount] = useState(String(profile?.expenseThreeAmount ?? ""));
  const [expenseFourName, setExpenseFourName] = useState(profile?.expenseFourName ?? "");
  const [expenseFourAmount, setExpenseFourAmount] = useState(String(profile?.expenseFourAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState<boolean | null>(typeof profile?.hasAllowance === "boolean" ? profile.hasAllowance : null);
  const [allowanceAmount, setAllowanceAmount] = useState(String(profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState<boolean | null>(typeof profile?.hasDebtsToManage === "boolean" ? profile.hasDebtsToManage : null);
  const [debtAmount, setDebtAmount] = useState(String(profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(profile?.debtNotes ?? "");

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [saving]);

  const displayName = useMemo(() => {
    const raw = (username ?? pendingRegistration?.username ?? "").trim();
    if (!raw) return "";
    return raw.length <= 1 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [pendingRegistration?.username, username]);

  const occupations = useMemo(() => {
    const normalizedIncoming = (initial.occupations ?? [])
      .map((item) => item.trim())
      .filter(Boolean);

    const base = [...normalizedIncoming, ...COMMON_OCCUPATIONS];

    const currentOccupation = occupation.trim();
    if (currentOccupation && !base.some((item) => item.toLowerCase() === currentOccupation.toLowerCase())) {
      base.unshift(currentOccupation);
    }

    if (!base.some((item) => item.toLowerCase() === "other")) {
      base.push("Other");
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const item of base) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped;
  }, [initial.occupations, occupation]);

  const incomeSourceOptions = useMemo(() => getIncomeSourceOptionsForOccupation(occupation), [occupation]);

  const resolvedOccupationOther = useMemo(() => {
    const normalizedOccupation = occupation.trim().toLowerCase();
    if (normalizedOccupation === "other") {
      return occupationOther.trim();
    }

    if (occupationRequiresIncomeSource(normalizedOccupation)) {
      const selectedSource = incomeSource.trim();
      if (!selectedSource) return "";
      if (selectedSource.toLowerCase() === "other") {
        return incomeSourceOther.trim();
      }
      return selectedSource;
    }

    return "";
  }, [incomeSource, incomeSourceOther, occupation, occupationOther]);

  const setOccupationWithDependencies = useCallback((nextOccupation: string) => {
    const currentNormalized = occupation.trim().toLowerCase();
    const nextNormalized = nextOccupation.trim().toLowerCase();

    setOccupation(nextOccupation);

    const needsOccupationDetail = nextNormalized === "other";
    const needsIncomeSource = occupationRequiresIncomeSource(nextNormalized);

    if (!needsOccupationDetail) {
      setOccupationOther("");
    }

    if (!needsIncomeSource) {
      setIncomeSource("");
      setIncomeSourceOther("");
      return;
    }

    if (currentNormalized !== nextNormalized) {
      setIncomeSource("");
      setIncomeSourceOther("");
    }
  }, [occupation]);

  const setIncomeSourceWithDependencies = useCallback((nextSource: string) => {
    setIncomeSource(nextSource);
    if (nextSource.trim().toLowerCase() !== "other") {
      setIncomeSourceOther("");
    }
  }, []);

  const payDayNumber = useMemo(() => {
    const value = Number(payDay);
    if (!Number.isFinite(value)) return null;
    const wholeDay = Math.trunc(value);
    if (wholeDay < 1 || wholeDay > 31) return null;
    return wholeDay;
  }, [payDay]);

  const payload = useMemo(() => buildPayload({
    allowanceAmount,
    debtAmount,
    debtNotes,
    expenseFourAmount,
    expenseFourName,
    expenseOneAmount,
    expenseOneName,
    expenseThreeAmount,
    expenseThreeName,
    expenseTwoAmount,
    expenseTwoName,
    hasAllowance,
    hasDebts,
    mainGoals,
    occupation,
    occupationOther: resolvedOccupationOther,
    payDay,
    payAnchorDate,
    payFrequency,
    planningYears,
    salary,
    savingsGoalAmount,
    savingsGoalYear,
  }), [allowanceAmount, debtAmount, debtNotes, expenseFourAmount, expenseFourName, expenseOneAmount, expenseOneName, expenseThreeAmount, expenseThreeName, expenseTwoAmount, expenseTwoName, hasAllowance, hasDebts, mainGoals, occupation, payAnchorDate, payDay, payFrequency, planningYears, resolvedOccupationOther, salary, savingsGoalAmount, savingsGoalYear]);

  const saveDraft = useCallback(async () => {
    if (!token) {
      await updatePendingRegistrationProfile(payload);
      return;
    }

    await apiFetch("/api/bff/onboarding", {
      body: payload,
      method: "PATCH",
    });
  }, [payload, token, updatePendingRegistrationProfile]);

  const transitionToStep = useCallback((nextStep: number) => {
    setStep(nextStep);
  }, []);

  const onGoBackStep = useCallback(() => {
    if (saving) return;
    if (!token && pendingRegistration) {
      void updatePendingRegistrationProfile(payload);
    }
    const nextStep = Math.max(0, step - 1);
    if (nextStep === step) return;
    transitionToStep(nextStep);
  }, [payload, pendingRegistration, saving, step, token, transitionToStep, updatePendingRegistrationProfile]);

  const currentValidationError = useCallback((currentStep: number) => validateStep({
    allowanceAmount,
    debtAmount,
    debtNotes,
    expenseFourAmount,
    expenseFourName,
    expenseOneAmount,
    expenseOneName,
    expenseThreeAmount,
    expenseThreeName,
    expenseTwoAmount,
    expenseTwoName,
    hasAllowance,
    hasDebts,
    mainGoals,
    occupation,
    occupationOther,
    incomeSource,
    incomeSourceOther,
    payAnchorDate,
    payDayNumber,
    payFrequency,
    planningYears,
    salary,
    savingsGoalAmount,
    savingsGoalYear,
    step: currentStep,
  }), [allowanceAmount, debtAmount, debtNotes, expenseFourAmount, expenseFourName, expenseOneAmount, expenseOneName, expenseThreeAmount, expenseThreeName, expenseTwoAmount, expenseTwoName, hasAllowance, hasDebts, incomeSource, incomeSourceOther, mainGoals, occupation, occupationOther, payAnchorDate, payDayNumber, payFrequency, planningYears, salary, savingsGoalAmount, savingsGoalYear]);

  const onGoForwardStep = useCallback(() => {
    if (saving || step >= 5) return;
    const validationError = currentValidationError(step);
    if (validationError) {
      Alert.alert("Required", validationError);
      return;
    }
    if (!token && pendingRegistration) {
      void updatePendingRegistrationProfile(payload);
    }
    const nextStep = Math.min(5, step + 1);
    if (nextStep !== step) transitionToStep(nextStep);
  }, [currentValidationError, payload, pendingRegistration, saving, step, token, transitionToStep, updatePendingRegistrationProfile]);

  const onFinish = useCallback(async () => {
    try {
      const validationError = currentValidationError(5);
      if (validationError) {
        Alert.alert("Required", validationError);
        return;
      }
      setSaving(true);

      if (!token) {
        await completeRegistration(payload);
        onCompleted();
        return;
      }

      await saveDraft();
      await apiFetch("/api/bff/onboarding", { method: "POST", timeoutMs: 60_000 });
      onCompleted();
    } catch (err: unknown) {
      Alert.alert("Could not complete onboarding", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [completeRegistration, currentValidationError, onCompleted, payload, saveDraft, token]);

  const stepPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (saving) return false;
          const absX = Math.abs(gestureState.dx);
          const absY = Math.abs(gestureState.dy);
          return absX > 24 && absX > absY * 1.3;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (saving) return;
          if (gestureState.dx <= -80 || (gestureState.dx <= -50 && gestureState.vx <= -0.6)) {
            onGoForwardStep();
            return;
          }
          if (gestureState.dx >= 80 || (gestureState.dx >= 50 && gestureState.vx >= 0.6)) {
            onGoBackStep();
          }
        },
      }),
    [onGoBackStep, onGoForwardStep, saving],
  );

  return {
    allowanceAmount,
    currency,
    debtAmount,
    debtNotes,
    displayName,
    expenseFourAmount,
    expenseFourName,
    expenseOneAmount,
    expenseOneName,
    expenseThreeAmount,
    expenseThreeName,
    expenseTwoAmount,
    expenseTwoName,
    fontsLoaded,
    hasAllowance,
    hasDebts,
    incomeSource,
    incomeSourceOptions,
    incomeSourceOther,
    insets,
    mainGoals,
    occupation,
    occupationOther,
    occupations,
    onFinish,
    onGoBackStep,
    onGoForwardStep,
    onSignOut: () => void signOut(),
    payAnchorDate,
    payDay,
    payFrequency,
    planningYears,
    salary,
    saving,
    savingsGoalAmount,
    savingsGoalYear,
    setAllowanceAmount,
    setDebtAmount,
    setDebtNotes,
    setExpenseFourAmount,
    setExpenseFourName,
    setExpenseOneAmount,
    setExpenseOneName,
    setExpenseThreeAmount,
    setExpenseThreeName,
    setExpenseTwoAmount,
    setExpenseTwoName,
    setHasAllowance,
    setHasDebts,
    setIncomeSource: setIncomeSourceWithDependencies,
    setIncomeSourceOther,
    setOccupation: setOccupationWithDependencies,
    setOccupationOther,
    setPayAnchorDate,
    setPayDay: (value: string) => setPayDay(sanitizePayDayInput(value)),
    setPayFrequency,
    setPlanningYears,
    setSalary,
    setSavingsGoalAmount,
    setSavingsGoalYear: (value: string) => setSavingsGoalYear(value.replace(/[^0-9]/g, "").slice(0, 4)),
    step,
    stepPanHandlers: stepPanResponder.panHandlers,
    toggleGoal: (goalId: VisibleGoal) => {
      setMainGoals((previous) => {
        const has = previous.includes(goalId);
        if (has) {
          const filtered = previous.filter((goal) => goal !== goalId);
          return filtered.length ? filtered : previous;
        }
        return [...previous, goalId];
      });
    },
  };
}

export default useOnboardingScreenController;