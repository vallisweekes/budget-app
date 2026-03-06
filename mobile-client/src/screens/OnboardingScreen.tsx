import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Sacramento_400Regular } from "@expo-google-fonts/sacramento";
import { useFonts } from "expo-font";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { OnboardingProfile, OnboardingStatusResponse, Settings } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import NoteBadge from "@/components/Shared/NoteBadge";

type Goal = "improve_savings" | "manage_debts" | "track_spending" | "build_budget";

// Match the blue/purple used for the Expenses total hero.
const EXPENSES_TOTAL_BLUE = "#2a0a9e";

const ICON_COLORS = {
  build_budget: T.orange,
  track_spending: T.accent,
  improve_savings: T.green,
  manage_debts: T.red,
} satisfies Record<Goal, string>;

const STEP_ICON_COLORS = {
  0: T.orange,
  1: T.onAccent,
  2: T.green,
  3: T.onAccent,
  4: T.orange,
  5: T.red,
} satisfies Record<number, string>;

const GOALS: Array<{ id: Goal; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "build_budget", label: "Set up my monthly budget", icon: "calendar-outline" },
  { id: "track_spending", label: "Keep an eye on my spending", icon: "receipt-outline" },
  { id: "improve_savings", label: "Build my savings", icon: "trending-up-outline" },
  { id: "manage_debts", label: "Get on top of my debts", icon: "card-outline" },
];

export default function OnboardingScreen({
  initial,
  onCompleted,
}: {
  initial: OnboardingStatusResponse;
  onCompleted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Sacramento_400Regular,
  });
  const { username, signOut } = useAuth();
  const profile = initial.profile;
  const [step, setStep] = useState(0);
  const stepAdvanceLockRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<string | null>("GBP");

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
        // ignore
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

  const initialGoals = useMemo(() => {
    const fromProfile = (profile as (OnboardingProfile & { mainGoals?: Goal[] }) | null)?.mainGoals;
    const cleaned = Array.isArray(fromProfile) ? fromProfile.filter(Boolean) : [];
    if (cleaned.length) return Array.from(new Set(cleaned));
    const single = (profile?.mainGoal as Goal | null) ?? null;
    return single ? [single] : [];
  }, [profile]);

  const [mainGoals, setMainGoals] = useState<Goal[]>(initialGoals.length ? initialGoals : ["improve_savings"]);
  const mainGoalsRef = useRef<Goal[]>(initialGoals.length ? initialGoals : ["improve_savings"]);
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(profile?.occupationOther ?? "");
  const occupationRef = useRef(profile?.occupation ?? "");
  const occupationOtherRef = useRef(profile?.occupationOther ?? "");
  const [payDay, setPayDay] = useState(String(profile?.payDay ?? ""));
  const payDayRef = useRef(String(profile?.payDay ?? ""));
  const [payFrequency, setPayFrequency] = useState<"monthly" | "every_2_weeks" | "weekly" | null>(
    profile?.payFrequency === "weekly" ||
      profile?.payFrequency === "every_2_weeks" ||
      profile?.payFrequency === "monthly"
      ? profile.payFrequency
      : null
  );
  const payFrequencyRef = useRef<"monthly" | "every_2_weeks" | "weekly" | null>(
    profile?.payFrequency === "weekly" ||
      profile?.payFrequency === "every_2_weeks" ||
      profile?.payFrequency === "monthly"
      ? profile.payFrequency
      : null
  );
  const [billFrequency, setBillFrequency] = useState<"monthly" | "every_2_weeks" | null>(
    profile?.billFrequency === "every_2_weeks" || profile?.billFrequency === "monthly"
      ? profile.billFrequency
      : null
  );
  const billFrequencyRef = useRef<"monthly" | "every_2_weeks" | null>(
    profile?.billFrequency === "every_2_weeks" || profile?.billFrequency === "monthly"
      ? profile.billFrequency
      : null
  );
  const [salary, setSalary] = useState(String(profile?.monthlySalary ?? ""));
  const salaryRef = useRef(String(profile?.monthlySalary ?? ""));
  const [planningYears, setPlanningYears] = useState<string>(() => {
    const raw = Number(profile?.planningYears ?? 0);
    if (!Number.isFinite(raw) || raw < 1) return "10";
    return String(Math.min(30, Math.trunc(raw)));
  });
  const planningYearsRef = useRef<string>(planningYears);
  const [savingsGoalAmount, setSavingsGoalAmount] = useState(String(profile?.savingsGoalAmount ?? ""));
  const savingsGoalAmountRef = useRef(String(profile?.savingsGoalAmount ?? ""));
  const [savingsGoalYear, setSavingsGoalYear] = useState(String(profile?.savingsGoalYear ?? ""));
  const savingsGoalYearRef = useRef(String(profile?.savingsGoalYear ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(profile?.expenseOneName ?? "");
  const expenseOneNameRef = useRef(profile?.expenseOneName ?? "");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(profile?.expenseOneAmount ?? ""));
  const expenseOneAmountRef = useRef(String(profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(profile?.expenseTwoName ?? "");
  const expenseTwoNameRef = useRef(profile?.expenseTwoName ?? "");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(profile?.expenseTwoAmount ?? ""));
  const expenseTwoAmountRef = useRef(String(profile?.expenseTwoAmount ?? ""));
  const [expenseThreeName, setExpenseThreeName] = useState(profile?.expenseThreeName ?? "");
  const expenseThreeNameRef = useRef(profile?.expenseThreeName ?? "");
  const [expenseThreeAmount, setExpenseThreeAmount] = useState(String(profile?.expenseThreeAmount ?? ""));
  const expenseThreeAmountRef = useRef(String(profile?.expenseThreeAmount ?? ""));
  const [expenseFourName, setExpenseFourName] = useState(profile?.expenseFourName ?? "");
  const expenseFourNameRef = useRef(profile?.expenseFourName ?? "");
  const [expenseFourAmount, setExpenseFourAmount] = useState(String(profile?.expenseFourAmount ?? ""));
  const expenseFourAmountRef = useRef(String(profile?.expenseFourAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState<boolean | null>(
    typeof profile?.hasAllowance === "boolean" ? profile.hasAllowance : null
  );
  const hasAllowanceRef = useRef<boolean | null>(
    typeof profile?.hasAllowance === "boolean" ? profile.hasAllowance : null
  );
  const [allowanceAmount, setAllowanceAmount] = useState(String(profile?.allowanceAmount ?? ""));
  const allowanceAmountRef = useRef(String(profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState<boolean | null>(
    typeof profile?.hasDebtsToManage === "boolean" ? profile.hasDebtsToManage : null
  );
  const hasDebtsRef = useRef<boolean | null>(
    typeof profile?.hasDebtsToManage === "boolean" ? profile.hasDebtsToManage : null
  );
  const [debtAmount, setDebtAmount] = useState(String(profile?.debtAmount ?? ""));
  const debtAmountRef = useRef(String(profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(profile?.debtNotes ?? "");
  const debtNotesRef = useRef(profile?.debtNotes ?? "");

  const occupations = useMemo(() => initial.occupations ?? [], [initial.occupations]);

  const payDayNumber = useMemo(() => {
    const value = Number(payDay);
    if (!Number.isFinite(value)) return null;
    const wholeDay = Math.trunc(value);
    if (wholeDay < 1 || wholeDay > 31) return null;
    return wholeDay;
  }, [payDay]);

  const payload: Partial<OnboardingProfile> = {
    mainGoal: mainGoalsRef.current[0] ?? null,
    mainGoals: mainGoalsRef.current,
    occupation: occupationRef.current,
    occupationOther: occupationOtherRef.current,
    payDay: payDayRef.current ? Math.max(1, Math.min(31, Number(payDayRef.current))) : null,
    payFrequency: payFrequencyRef.current ?? undefined,
    billFrequency: billFrequencyRef.current ?? undefined,
    monthlySalary: salaryRef.current ? Number(salaryRef.current) : null,
    planningYears: planningYearsRef.current ? Number(planningYearsRef.current) : null,
    savingsGoalAmount: savingsGoalAmountRef.current ? Number(savingsGoalAmountRef.current) : null,
    savingsGoalYear: savingsGoalYearRef.current ? Number(savingsGoalYearRef.current) : null,
    expenseOneName: expenseOneNameRef.current,
    expenseOneAmount: expenseOneAmountRef.current ? Number(expenseOneAmountRef.current) : null,
    expenseTwoName: expenseTwoNameRef.current,
    expenseTwoAmount: expenseTwoAmountRef.current ? Number(expenseTwoAmountRef.current) : null,
    expenseThreeName: expenseThreeNameRef.current,
    expenseThreeAmount: expenseThreeAmountRef.current ? Number(expenseThreeAmountRef.current) : null,
    expenseFourName: expenseFourNameRef.current,
    expenseFourAmount: expenseFourAmountRef.current ? Number(expenseFourAmountRef.current) : null,
    hasAllowance: hasAllowanceRef.current ?? undefined,
    allowanceAmount: hasAllowanceRef.current === true && allowanceAmountRef.current ? Number(allowanceAmountRef.current) : null,
    hasDebtsToManage: hasDebtsRef.current ?? undefined,
    debtAmount: hasDebtsRef.current === true && debtAmountRef.current ? Number(debtAmountRef.current) : null,
    debtNotes: debtNotesRef.current,
  };

  const isPositiveNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  };

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 0 && mainGoalsRef.current.length === 0) {
      return "Please choose at least one goal to continue.";
    }

    if (currentStep === 1) {
      const selectedOccupation = occupationRef.current.trim();
      const selectedOccupationOther = occupationOtherRef.current.trim();
      if (!selectedOccupation) return "Please select what kind of work you do.";
      if (selectedOccupation === "Other" && !selectedOccupationOther) return "Please enter your occupation.";
    }

    if (currentStep === 2) {
      if (!payDayNumber) return "Please enter the day of the month you get paid.";
      if (!payFrequencyRef.current) return "Please choose how often you get paid.";
      if (!billFrequencyRef.current) return "Please choose how often you pay most bills.";
      if (!isPositiveNumber(salaryRef.current)) return "Please enter your monthly salary to continue.";
      const years = Number(planningYearsRef.current);
      if (!Number.isInteger(years) || years < 1 || years > 30) {
        return "Please choose how far ahead you want to plan.";
      }
    }

    if (currentStep === 3) {
      const hasAllBillNamesNow =
        expenseOneNameRef.current.trim().length > 0 &&
        expenseTwoNameRef.current.trim().length > 0 &&
        expenseThreeNameRef.current.trim().length > 0 &&
        expenseFourNameRef.current.trim().length > 0;
      const hasAllBillAmountsNow =
        isPositiveNumber(expenseOneAmountRef.current) &&
        isPositiveNumber(expenseTwoAmountRef.current) &&
        isPositiveNumber(expenseThreeAmountRef.current) &&
        isPositiveNumber(expenseFourAmountRef.current);
      if (!hasAllBillNamesNow) return "Please add a name for each monthly bill.";
      if (!hasAllBillAmountsNow) return "Please add an amount for each monthly bill.";
    }

    if (currentStep === 4) {
      if (hasAllowanceRef.current === null) return "Please choose Yes or No for spending money.";
      if (hasAllowanceRef.current === true && !isPositiveNumber(allowanceAmountRef.current)) {
        return "Please enter your spending money amount.";
      }
    }

    if (currentStep === 5) {
      if (hasDebtsRef.current === null) return "Please choose Yes or No for debts.";
      if (hasDebtsRef.current === true && !isPositiveNumber(debtAmountRef.current)) {
        return "Please enter your debt amount.";
      }

      const isSavingsFocus = mainGoalsRef.current.includes("improve_savings");
      const goalAmount = Number(savingsGoalAmountRef.current);
      const goalYear = Number(savingsGoalYearRef.current);
      const currentYear = new Date().getFullYear();

      if (isSavingsFocus && !(Number.isFinite(goalAmount) && goalAmount > 0)) {
        return "Please enter a savings goal amount so we can build your projection.";
      }
      if (isSavingsFocus && !(Number.isInteger(goalYear) && goalYear >= currentYear && goalYear <= currentYear + 30)) {
        return "Please enter a valid savings target year.";
      }

      if (savingsGoalYearRef.current.trim().length > 0 && !(Number.isInteger(goalYear) && goalYear >= 2000 && goalYear <= 2200)) {
        return "Please enter a valid year for your savings goal.";
      }
    }

    return null;
  };

  useEffect(() => {
    mainGoalsRef.current = mainGoals;
  }, [mainGoals]);

  useEffect(() => {
    occupationRef.current = occupation;
  }, [occupation]);

  useEffect(() => {
    occupationOtherRef.current = occupationOther;
  }, [occupationOther]);

  useEffect(() => {
    payDayRef.current = payDay;
  }, [payDay]);

  useEffect(() => {
    payFrequencyRef.current = payFrequency;
  }, [payFrequency]);

  useEffect(() => {
    billFrequencyRef.current = billFrequency;
  }, [billFrequency]);

  useEffect(() => {
    salaryRef.current = salary;
  }, [salary]);

  useEffect(() => {
    planningYearsRef.current = planningYears;
  }, [planningYears]);

  useEffect(() => {
    savingsGoalAmountRef.current = savingsGoalAmount;
  }, [savingsGoalAmount]);

  useEffect(() => {
    savingsGoalYearRef.current = savingsGoalYear;
  }, [savingsGoalYear]);

  useEffect(() => {
    expenseOneNameRef.current = expenseOneName;
  }, [expenseOneName]);

  useEffect(() => {
    expenseOneAmountRef.current = expenseOneAmount;
  }, [expenseOneAmount]);

  useEffect(() => {
    expenseTwoNameRef.current = expenseTwoName;
  }, [expenseTwoName]);

  useEffect(() => {
    expenseTwoAmountRef.current = expenseTwoAmount;
  }, [expenseTwoAmount]);

  useEffect(() => {
    expenseThreeNameRef.current = expenseThreeName;
  }, [expenseThreeName]);

  useEffect(() => {
    expenseThreeAmountRef.current = expenseThreeAmount;
  }, [expenseThreeAmount]);

  useEffect(() => {
    expenseFourNameRef.current = expenseFourName;
  }, [expenseFourName]);

  useEffect(() => {
    expenseFourAmountRef.current = expenseFourAmount;
  }, [expenseFourAmount]);

  useEffect(() => {
    hasAllowanceRef.current = hasAllowance;
  }, [hasAllowance]);

  useEffect(() => {
    allowanceAmountRef.current = allowanceAmount;
  }, [allowanceAmount]);

  useEffect(() => {
    hasDebtsRef.current = hasDebts;
  }, [hasDebts]);

  useEffect(() => {
    debtAmountRef.current = debtAmount;
  }, [debtAmount]);

  useEffect(() => {
    debtNotesRef.current = debtNotes;
  }, [debtNotes]);

  const saveDraft = async () => {
    await apiFetch("/api/bff/onboarding", {
      method: "PATCH",
      body: payload,
    });
  };

  const finish = async () => {
    try {
      const validationError = validateStep(5);
      if (validationError) {
        Alert.alert("Required", validationError);
        return;
      }

      setSaving(true);
      await saveDraft();
      await apiFetch("/api/bff/onboarding", { method: "POST" });
      onCompleted();
    } catch (err: unknown) {
      Alert.alert("Could not complete onboarding", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const transitionToStep = useCallback((nextStep: number) => {
    setStep(nextStep);
  }, []);

  const goBackStep = useCallback(() => {
    if (saving) return;
    const nextStep = Math.max(0, step - 1);
    if (nextStep === step) return;
    transitionToStep(nextStep);
  }, [saving, step, transitionToStep]);

  const goForwardStep = useCallback(async () => {
    if (stepAdvanceLockRef.current || saving || step >= 5) return;

    try {
      const validationError = validateStep(step);
      if (validationError) {
        Alert.alert("Required", validationError);
        return;
      }

      stepAdvanceLockRef.current = true;
      setSaving(true);
      await saveDraft();

      const nextStep = Math.min(5, step + 1);
      if (nextStep !== step) {
        transitionToStep(nextStep);
      }
    } catch (err: unknown) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
      stepAdvanceLockRef.current = false;
    }
  }, [saving, step, transitionToStep]);

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
            void goForwardStep();
            return;
          }

          if (gestureState.dx >= 80 || (gestureState.dx >= 50 && gestureState.vx >= 0.6)) {
            goBackStep();
          }
        },
      }),
    [goBackStep, goForwardStep, saving]
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Pressable
        onPress={() => void signOut()}
        disabled={saving}
        style={[s.floatingLogoutBtn, { top: insets.top + 10 }, saving && s.disabled]}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Logout"
      >
        <Text style={s.floatingLogoutText}>Logout</Text>
      </Pressable>

      {step > 0 ? (
        <Pressable
          onPress={goBackStep}
          disabled={saving}
          style={[s.floatingBackBtn, { top: insets.top + 10 }, saving && s.disabled]}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>
      ) : null}

      <View style={s.gestureWrap} {...stepPanResponder.panHandlers}>
          <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
            <View>
          {step === 0 ? (
            <View style={s.header}>
              <Text style={[s.welcome, fontsLoaded && s.welcomeScript]}>Welcome</Text>
              {displayName ? <Text style={s.welcomeName}>{displayName}</Text> : null}
              <Text style={s.sub} numberOfLines={1} ellipsizeMode="tail">
                Quick setup, then you’re in.
              </Text>
            </View>
          ) : null}

          <View style={s.form}>
          {step === 0 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="sparkles-outline" size={20} color={STEP_ICON_COLORS[0]} />
                <Text style={s.question}>What do you want help with most right now?</Text>
              </View>
              {GOALS.map((goal) => {
                const isSelected = mainGoals.includes(goal.id);
                return (
                  <Pressable
                    key={goal.id}
                    onPress={() => {
                      const prev = mainGoalsRef.current;
                      const has = prev.includes(goal.id);
                      let next = prev;
                      if (has) {
                        const filtered = prev.filter((g) => g !== goal.id);
                        next = filtered.length ? filtered : prev;
                      } else {
                        next = [...prev, goal.id];
                      }
                      mainGoalsRef.current = next;
                      setMainGoals(next);
                    }}
                    style={[s.option, isSelected && s.optionActive]}
                  >
                    <View style={s.optionRow}>
                      <View style={s.optionLeft}>
                        <Ionicons name={goal.icon} size={18} color={ICON_COLORS[goal.id]} />
                        <Text style={[s.optionText, isSelected && s.optionTextActive]}>{goal.label}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color="#ffffff"
                      />
                    </View>
                  </Pressable>
                );
              })}
              <Text style={s.helper}>You can pick more than one.</Text>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="briefcase-outline" size={20} color={STEP_ICON_COLORS[1]} />
                <Text style={s.question}>What kind of work do you do?</Text>
              </View>
              <View style={s.chipsWrap}>
                {occupations.map((item) => {
                  const active = occupation === item;
                  return (
                    <Pressable
                      key={item}
                        onPress={() => {
                          occupationRef.current = item;
                          setOccupation(item);
                        }}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          active && s.chipTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {occupation === "Other" ? (
                <TextInput
                  value={occupationOther}
                  onChangeText={(value) => {
                    occupationOtherRef.current = value;
                    setOccupationOther(value);
                  }}
                  placeholder="Your occupation"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={s.input}
                />
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="wallet-outline" size={20} color={STEP_ICON_COLORS[2]} />
                <Text style={s.question}>What day of the month do you usually get paid?</Text>
              </View>
              <TextInput
                value={payDay}
                onChangeText={(value) => {
                  const next = value.replace(/[^0-9]/g, "").slice(0, 2);
                  payDayRef.current = next;
                  setPayDay(next);
                }}
                placeholder="For example: 15"
                placeholderTextColor="rgba(255,255,255,0.62)"
                keyboardType="number-pad"
                style={s.input}
                accessibilityLabel="Enter your payday as a day of the month"
              />
              <Text style={s.helper}>Enter just the day number, from 1 to 31.</Text>

              <Text style={s.question}>How often do you get paid?</Text>
              <View style={s.chipsWrap}>
                {[
                  { id: "monthly", label: "Monthly" },
                  { id: "every_2_weeks", label: "Every 2 weeks" },
                  { id: "weekly", label: "Weekly" },
                ].map((item) => {
                  const active = payFrequency === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        const next = item.id as "monthly" | "every_2_weeks" | "weekly";
                        payFrequencyRef.current = next;
                        setPayFrequency(next);
                      }}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          active && s.chipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={s.question}>How often do you usually pay most bills?</Text>
              <View style={s.chipsWrap}>
                {[
                  { id: "monthly", label: "Monthly" },
                  { id: "every_2_weeks", label: "Every 2 weeks" },
                ].map((item) => {
                  const active = billFrequency === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        const next = item.id as "monthly" | "every_2_weeks";
                        billFrequencyRef.current = next;
                        setBillFrequency(next);
                      }}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          active && s.chipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.question}>About how much do you bring in each month?</Text>
              <MoneyInput
                currency={currency}
                value={salary}
                onChangeValue={(value) => {
                  salaryRef.current = value;
                  setSalary(value);
                }}
                variant="light"
                placeholder="0.00"
              />

              <Text style={s.question}>How many years ahead do you want to plan your income?</Text>
              <View style={s.chipsWrap}>
                {[
                  { id: "1", label: "1 year" },
                  { id: "3", label: "3 years" },
                  { id: "5", label: "5 years" },
                  { id: "10", label: "10 years" },
                ].map((item) => {
                  const active = planningYears === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        planningYearsRef.current = item.id;
                        setPlanningYears(item.id);
                      }}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="receipt-outline" size={20} color={STEP_ICON_COLORS[3]} />
                <Text style={s.question}>What are the 4 bills you pay every month?</Text>
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseOneName}
                  onChangeText={(value) => {
                    expenseOneNameRef.current = value;
                    setExpenseOneName(value);
                  }}
                  placeholder="Rent, mortgage"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput
                  currency={currency}
                  value={expenseOneAmount}
                  onChangeValue={(value) => {
                    expenseOneAmountRef.current = value;
                    setExpenseOneAmount(value);
                  }}
                  variant="light"
                  placeholder="0.00"
                  containerStyle={s.rowInput}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseTwoName}
                  onChangeText={(value) => {
                    expenseTwoNameRef.current = value;
                    setExpenseTwoName(value);
                  }}
                  placeholder="Groceries, Dining"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput
                  currency={currency}
                  value={expenseTwoAmount}
                  onChangeValue={(value) => {
                    expenseTwoAmountRef.current = value;
                    setExpenseTwoAmount(value);
                  }}
                  variant="light"
                  placeholder="0.00"
                  containerStyle={s.rowInput}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseThreeName}
                  onChangeText={(value) => {
                    expenseThreeNameRef.current = value;
                    setExpenseThreeName(value);
                  }}
                  placeholder="EE, Vodafone"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput
                  currency={currency}
                  value={expenseThreeAmount}
                  onChangeValue={(value) => {
                    expenseThreeAmountRef.current = value;
                    setExpenseThreeAmount(value);
                  }}
                  variant="light"
                  placeholder="0.00"
                  containerStyle={s.rowInput}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseFourName}
                  onChangeText={(value) => {
                    expenseFourNameRef.current = value;
                    setExpenseFourName(value);
                  }}
                  placeholder="Netflix, Spotify"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput
                  currency={currency}
                  value={expenseFourAmount}
                  onChangeValue={(value) => {
                    expenseFourAmountRef.current = value;
                    setExpenseFourAmount(value);
                  }}
                  variant="light"
                  placeholder="0.00"
                  containerStyle={s.rowInput}
                />
              </View>

              <NoteBadge
                text="These are your regular monthly bills. If you know the company name, enter it (it helps keep things accurate)."
                accentStyle={{ backgroundColor: T.red, width: 8 }}
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="happy-outline" size={20} color={STEP_ICON_COLORS[4]} />
                <Text style={s.question}>Do you set aside spending money for yourself?</Text>
              </View>
              <View style={s.toggleRow}>
                <Pressable
                  onPress={() => {
                    hasAllowanceRef.current = true;
                    setHasAllowance(true);
                  }}
                  style={[s.toggle, hasAllowance && s.toggleActive]}
                ><Text style={[s.toggleText, hasAllowance && s.toggleTextActive]}>Yes</Text></Pressable>
                <Pressable
                  onPress={() => {
                    hasAllowanceRef.current = false;
                    setHasAllowance(false);
                  }}
                  style={[s.toggle, !hasAllowance && s.toggleActive]}
                ><Text style={[s.toggleText, !hasAllowance && s.toggleTextActive]}>No</Text></Pressable>
              </View>
              {hasAllowance ? (
                <MoneyInput
                  currency={currency}
                  value={allowanceAmount}
                  onChangeValue={(value) => {
                    allowanceAmountRef.current = value;
                    setAllowanceAmount(value);
                  }}
                  variant="light"
                  placeholder="0.00"
                />
              ) : null}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="card-outline" size={20} color={STEP_ICON_COLORS[5]} />
                <Text style={s.question}>Do you have any debts you want to pay down?</Text>
              </View>
              <View style={s.toggleRow}>
                <Pressable
                  onPress={() => {
                    hasDebtsRef.current = true;
                    setHasDebts(true);
                  }}
                  style={[s.toggle, hasDebts && s.toggleActive]}
                ><Text style={[s.toggleText, hasDebts && s.toggleTextActive]}>Yes</Text></Pressable>
                <Pressable
                  onPress={() => {
                    hasDebtsRef.current = false;
                    setHasDebts(false);
                  }}
                  style={[s.toggle, !hasDebts && s.toggleActive]}
                ><Text style={[s.toggleText, !hasDebts && s.toggleTextActive]}>No</Text></Pressable>
              </View>
              {hasDebts ? (
                <>
                  <MoneyInput
                    currency={currency}
                    value={debtAmount}
                    onChangeValue={(value) => {
                      debtAmountRef.current = value;
                      setDebtAmount(value);
                    }}
                    variant="light"
                    placeholder="0.00"
                  />
                  <TextInput
                    value={debtNotes}
                    onChangeText={(value) => {
                      debtNotesRef.current = value;
                      setDebtNotes(value);
                    }}
                    placeholder="Any notes? (optional)"
                    placeholderTextColor="rgba(255,255,255,0.62)"
                    style={s.input}
                  />
                </>
              ) : null}

              <Text style={s.question}>Savings goal amount (for your projection)</Text>
              <MoneyInput
                currency={currency}
                value={savingsGoalAmount}
                onChangeValue={(value) => {
                  savingsGoalAmountRef.current = value;
                  setSavingsGoalAmount(value);
                }}
                variant="light"
                placeholder="0.00"
              />

              <Text style={s.question}>What year do you want to hit that goal?</Text>
              <TextInput
                value={savingsGoalYear}
                onChangeText={(value) => {
                  const next = value.replace(/[^0-9]/g, "").slice(0, 4);
                  savingsGoalYearRef.current = next;
                  setSavingsGoalYear(next);
                }}
                placeholder="e.g. 2028"
                placeholderTextColor="rgba(255,255,255,0.62)"
                keyboardType="number-pad"
                style={s.input}
              />
            </>
          ) : null}

          <View style={s.footerRow}>
            {step < 5 ? (
              <Pressable
                onPress={() => {
                  void goForwardStep();
                }}
                disabled={saving}
                style={[saving ? s.primaryBtnCircle : s.primaryBtn, saving && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel={step === 0 ? "Let's go" : "Next"}
              >
                {saving ? (
                  <ActivityIndicator color={EXPENSES_TOTAL_BLUE} />
                ) : (
                  <Text style={s.primaryBtnText}>{step === 0 ? "Let's go" : "Next"}</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={finish}
                disabled={saving}
                style={[saving ? s.primaryBtnCircle : s.primaryBtn, saving && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Finish"
              >
                {saving ? <ActivityIndicator color={EXPENSES_TOTAL_BLUE} /> : <Text style={s.primaryBtnText}>Finish</Text>}
              </Pressable>
            )}
          </View>
          </View>
            </View>
          </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EXPENSES_TOTAL_BLUE },
  gestureWrap: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, justifyContent: "center" },
  floatingBackBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    elevation: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingLogoutBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingLogoutText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  header: { minHeight: 220, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  welcome: {
    color: "#ffffff",
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: 0.2,
    textAlign: "center",
    lineHeight: 52,
  },
  welcomeScript: {
    fontFamily: "Sacramento_400Regular",
    fontWeight: "400",
    lineHeight: 64,
    paddingTop: 8,
  },
  welcomeName: {
    color: "#ffffff",
    marginTop: 2,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  sub: { color: "rgba(255,255,255,0.78)", marginTop: 10, fontSize: 13, fontWeight: "800", textAlign: "center", maxWidth: 360 },
  form: { gap: 10 },
  questionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  question: { color: "#ffffff", fontSize: 16, fontWeight: "900", flexShrink: 1 },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  optionActive: {
    borderColor: "rgba(255,255,255,0.8)",
  },
  optionText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  optionTextActive: { color: "#ffffff" },
  helper: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "relative",
    overflow: "hidden",
  },
  chipActive: {
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  chipActiveLiquid: {
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "transparent",
  },
  chipText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: EXPENSES_TOTAL_BLUE },
  chipTextActiveLiquid: { color: "#ffffff" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
  },
  row: { flexDirection: "row", gap: 10 },
  rowInput: { flex: 1 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleActive: {
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  toggleText: { color: "#ffffff", fontWeight: "800" },
  toggleTextActive: { color: "#ffffff" },
  footerRow: { marginTop: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  primaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  primaryBtnText: {
    color: EXPENSES_TOTAL_BLUE,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  primaryBtnCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  disabled: { opacity: 0.55 },
});
