import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { OnboardingProfile, Settings } from "@/lib/apiTypes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, PanResponder, Platform, UIManager } from "react-native";
import { Sacramento_400Regular } from "@expo-google-fonts/sacramento";
import { useFonts } from "expo-font";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OnboardingScreenProps, VisibleGoal } from "@/types/OnboardingScreen.types";
import { buildInitialGoals, isPositiveNumber } from "@/components/OnboardingScreen/utils";

type Frequency = "monthly" | "every_2_weeks" | "weekly" | null;
type BillFrequency = "monthly" | "every_2_weeks" | null;

function buildPayload(state: {
  allowanceAmount: string;
  billFrequency: BillFrequency;
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
  payFrequency: Frequency;
  planningYears: string;
  salary: string;
  savingsGoalAmount: string;
  savingsGoalYear: string;
}): Partial<OnboardingProfile> {
  return {
    allowanceAmount: state.hasAllowance === true && state.allowanceAmount ? Number(state.allowanceAmount) : null,
    billFrequency: state.billFrequency ?? undefined,
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
    payDay: state.payDay ? Math.max(1, Math.min(31, Number(state.payDay))) : null,
    payFrequency: state.payFrequency ?? undefined,
    planningYears: state.planningYears ? Number(state.planningYears) : null,
    savingsGoalAmount: state.savingsGoalAmount ? Number(state.savingsGoalAmount) : null,
    savingsGoalYear: state.savingsGoalYear ? Number(state.savingsGoalYear) : null,
  };
}

function validateStep(params: {
  allowanceAmount: string;
  billFrequency: BillFrequency;
  debtAmount: string;
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
    billFrequency,
    debtAmount,
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
    if (!occupation.trim()) return "Please select what kind of work you do.";
    if (occupation === "Other" && !occupationOther.trim()) return "Please enter your occupation.";
  }

  if (step === 2) {
    if (!payDayNumber) return "Please enter the day of the month you get paid.";
    if (!payFrequency) return "Please choose how often you get paid.";
    if (!billFrequency) return "Please choose how often you pay most bills.";
    if (!isPositiveNumber(salary)) return "Please enter your monthly salary to continue.";
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
  const { username, signOut } = useAuth();
  const profile = initial.profile;
  const stepAdvanceLockRef = useRef(false);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<string | null>("GBP");
  const [mainGoals, setMainGoals] = useState<VisibleGoal[]>(() => buildInitialGoals(profile));
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(profile?.occupationOther ?? "");
  const [payDay, setPayDay] = useState(String(profile?.payDay ?? ""));
  const [payFrequency, setPayFrequency] = useState<Frequency>(
    profile?.payFrequency === "weekly" ||
      profile?.payFrequency === "every_2_weeks" ||
      profile?.payFrequency === "monthly"
      ? profile.payFrequency
      : null,
  );
  const [billFrequency, setBillFrequency] = useState<BillFrequency>(
    profile?.billFrequency === "every_2_weeks" || profile?.billFrequency === "monthly"
      ? profile.billFrequency
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

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const settings = await apiFetch<Settings>("/api/bff/settings");
        if (!mounted) return;
        setCurrency(settings?.currency ?? "GBP");
      } catch {
        // Best effort only; onboarding can continue with the default currency.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(() => {
    const raw = (username ?? "").trim();
    if (!raw) return "";
    return raw.length <= 1 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [username]);

  const occupations = useMemo(() => initial.occupations ?? [], [initial.occupations]);
  const payDayNumber = useMemo(() => {
    const value = Number(payDay);
    if (!Number.isFinite(value)) return null;
    const wholeDay = Math.trunc(value);
    if (wholeDay < 1 || wholeDay > 31) return null;
    return wholeDay;
  }, [payDay]);

  const payload = useMemo(() => buildPayload({
    allowanceAmount,
    billFrequency,
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
    payDay,
    payFrequency,
    planningYears,
    salary,
    savingsGoalAmount,
    savingsGoalYear,
  }), [allowanceAmount, billFrequency, debtAmount, debtNotes, expenseFourAmount, expenseFourName, expenseOneAmount, expenseOneName, expenseThreeAmount, expenseThreeName, expenseTwoAmount, expenseTwoName, hasAllowance, hasDebts, mainGoals, occupation, occupationOther, payDay, payFrequency, planningYears, salary, savingsGoalAmount, savingsGoalYear]);

  const saveDraft = useCallback(async () => {
    await apiFetch("/api/bff/onboarding", {
      body: payload,
      method: "PATCH",
    });
  }, [payload]);

  const transitionToStep = useCallback((nextStep: number) => {
    setStep(nextStep);
  }, []);

  const onGoBackStep = useCallback(() => {
    if (saving) return;
    const nextStep = Math.max(0, step - 1);
    if (nextStep === step) return;
    transitionToStep(nextStep);
  }, [saving, step, transitionToStep]);

  const currentValidationError = useCallback((currentStep: number) => validateStep({
    allowanceAmount,
    billFrequency,
    debtAmount,
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
    payDayNumber,
    payFrequency,
    planningYears,
    salary,
    savingsGoalAmount,
    savingsGoalYear,
    step: currentStep,
  }), [allowanceAmount, billFrequency, debtAmount, expenseFourAmount, expenseFourName, expenseOneAmount, expenseOneName, expenseThreeAmount, expenseThreeName, expenseTwoAmount, expenseTwoName, hasAllowance, hasDebts, mainGoals, occupation, occupationOther, payDayNumber, payFrequency, planningYears, salary, savingsGoalAmount, savingsGoalYear]);

  const onGoForwardStep = useCallback(async () => {
    if (stepAdvanceLockRef.current || saving || step >= 5) return;
    try {
      const validationError = currentValidationError(step);
      if (validationError) {
        Alert.alert("Required", validationError);
        return;
      }
      stepAdvanceLockRef.current = true;
      setSaving(true);
      await saveDraft();
      const nextStep = Math.min(5, step + 1);
      if (nextStep !== step) transitionToStep(nextStep);
    } catch (err: unknown) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
      stepAdvanceLockRef.current = false;
    }
  }, [currentValidationError, saveDraft, saving, step, transitionToStep]);

  const onFinish = useCallback(async () => {
    try {
      const validationError = currentValidationError(5);
      if (validationError) {
        Alert.alert("Required", validationError);
        return;
      }
      setSaving(true);
      await saveDraft();
      await apiFetch("/api/bff/onboarding", { method: "POST", timeoutMs: 60_000 });
      onCompleted();
    } catch (err: unknown) {
      Alert.alert("Could not complete onboarding", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [currentValidationError, onCompleted, saveDraft]);

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
            void onGoForwardStep();
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
    billFrequency,
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
    insets,
    mainGoals,
    occupation,
    occupationOther,
    occupations,
    onFinish,
    onGoBackStep,
    onGoForwardStep,
    onSignOut: () => void signOut(),
    payDay,
    payFrequency,
    planningYears,
    salary,
    saving,
    savingsGoalAmount,
    savingsGoalYear,
    setAllowanceAmount,
    setBillFrequency,
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
    setOccupation,
    setOccupationOther,
    setPayDay: (value: string) => setPayDay(value.replace(/[^0-9]/g, "").slice(0, 2)),
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