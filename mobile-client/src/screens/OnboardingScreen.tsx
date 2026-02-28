import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { OnboardingProfile, OnboardingStatusResponse } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";

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
  const { username, signOut } = useAuth();
  const profile = initial.profile;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

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
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(profile?.occupationOther ?? "");
  const [salary, setSalary] = useState(String(profile?.monthlySalary ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(profile?.expenseOneName ?? "");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(profile?.expenseTwoName ?? "");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(profile?.expenseTwoAmount ?? ""));
  const [expenseThreeName, setExpenseThreeName] = useState(profile?.expenseThreeName ?? "");
  const [expenseThreeAmount, setExpenseThreeAmount] = useState(String(profile?.expenseThreeAmount ?? ""));
  const [expenseFourName, setExpenseFourName] = useState(profile?.expenseFourName ?? "");
  const [expenseFourAmount, setExpenseFourAmount] = useState(String(profile?.expenseFourAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState(Boolean(profile?.hasAllowance));
  const [allowanceAmount, setAllowanceAmount] = useState(String(profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState(Boolean(profile?.hasDebtsToManage));
  const [debtAmount, setDebtAmount] = useState(String(profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(profile?.debtNotes ?? "");

  const occupations = useMemo(() => initial.occupations ?? [], [initial.occupations]);

  const payload: Partial<OnboardingProfile> = {
    mainGoal: mainGoals[0] ?? null,
    mainGoals,
    occupation,
    occupationOther,
    monthlySalary: salary ? Number(salary) : null,
    expenseOneName,
    expenseOneAmount: expenseOneAmount ? Number(expenseOneAmount) : null,
    expenseTwoName,
    expenseTwoAmount: expenseTwoAmount ? Number(expenseTwoAmount) : null,
    expenseThreeName,
    expenseThreeAmount: expenseThreeAmount ? Number(expenseThreeAmount) : null,
    expenseFourName,
    expenseFourAmount: expenseFourAmount ? Number(expenseFourAmount) : null,
    hasAllowance,
    allowanceAmount: hasAllowance && allowanceAmount ? Number(allowanceAmount) : null,
    hasDebtsToManage: hasDebts,
    debtAmount: hasDebts && debtAmount ? Number(debtAmount) : null,
    debtNotes,
  };

  const saveDraft = async () => {
    await apiFetch("/api/bff/onboarding", {
      method: "PATCH",
      body: payload,
    });
  };

  const finish = async () => {
    try {
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

  const goBackStep = () => {
    setStep((prev) => Math.max(0, prev - 1));
  };

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

      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={s.header}>
            <Text style={s.welcome}>Welcome{displayName ? ` ${displayName}` : ""}</Text>
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
              {GOALS.map((goal) => (
                <Pressable
                  key={goal.id}
                  onPress={() =>
                    setMainGoals((prev) => {
                      const has = prev.includes(goal.id);
                      if (has) {
                        const next = prev.filter((g) => g !== goal.id);
                        return next.length ? next : prev;
                      }
                      return [...prev, goal.id];
                    })
                  }
                  style={[s.option, mainGoals.includes(goal.id) && s.optionActive]}
                >
                  <View style={s.optionRow}>
                    <View style={s.optionLeft}>
                      <Ionicons name={goal.icon} size={18} color={ICON_COLORS[goal.id]} />
                      <Text style={[s.optionText, mainGoals.includes(goal.id) && s.optionTextActive]}>{goal.label}</Text>
                    </View>
                    {mainGoals.includes(goal.id) ? <Ionicons name="checkmark-circle" size={18} color="#ffffff" /> : null}
                  </View>
                </Pressable>
              ))}
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
                    <Pressable key={item} onPress={() => setOccupation(item)} style={[s.chip, active && s.chipActive]}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {occupation === "Other" ? (
                <TextInput
                  value={occupationOther}
                  onChangeText={setOccupationOther}
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
                <Text style={s.question}>About how much do you bring in each month?</Text>
              </View>
              <TextInput
                value={salary}
                onChangeText={setSalary}
                keyboardType="decimal-pad"
                placeholder="e.g. 2500"
                placeholderTextColor="rgba(255,255,255,0.62)"
                style={s.input}
              />
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
                  onChangeText={setExpenseOneName}
                  placeholder="Rent, mortgage"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <TextInput
                  value={expenseOneAmount}
                  onChangeText={setExpenseOneAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseTwoName}
                  onChangeText={setExpenseTwoName}
                  placeholder="Electricity, water"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <TextInput
                  value={expenseTwoAmount}
                  onChangeText={setExpenseTwoAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseThreeName}
                  onChangeText={setExpenseThreeName}
                  placeholder="Phone bill"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <TextInput
                  value={expenseThreeAmount}
                  onChangeText={setExpenseThreeAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseFourName}
                  onChangeText={setExpenseFourName}
                  placeholder="Subscription"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <TextInput
                  value={expenseFourAmount}
                  onChangeText={setExpenseFourAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoCardText}>
                  These are your regular monthly bills. If you know the company name, enter it (it helps keep things accurate).
                </Text>
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <View style={s.questionRow}>
                <Ionicons name="happy-outline" size={20} color={STEP_ICON_COLORS[4]} />
                <Text style={s.question}>Do you set aside spending money for yourself?</Text>
              </View>
              <View style={s.toggleRow}>
                <Pressable onPress={() => setHasAllowance(true)} style={[s.toggle, hasAllowance && s.toggleActive]}><Text style={[s.toggleText, hasAllowance && s.toggleTextActive]}>Yes</Text></Pressable>
                <Pressable onPress={() => setHasAllowance(false)} style={[s.toggle, !hasAllowance && s.toggleActive]}><Text style={[s.toggleText, !hasAllowance && s.toggleTextActive]}>No</Text></Pressable>
              </View>
              {hasAllowance ? (
                <TextInput
                  value={allowanceAmount}
                  onChangeText={setAllowanceAmount}
                  keyboardType="decimal-pad"
                  placeholder="How much?"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={s.input}
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
                <Pressable onPress={() => setHasDebts(true)} style={[s.toggle, hasDebts && s.toggleActive]}><Text style={[s.toggleText, hasDebts && s.toggleTextActive]}>Yes</Text></Pressable>
                <Pressable onPress={() => setHasDebts(false)} style={[s.toggle, !hasDebts && s.toggleActive]}><Text style={[s.toggleText, !hasDebts && s.toggleTextActive]}>No</Text></Pressable>
              </View>
              {hasDebts ? (
                <>
                  <TextInput
                    value={debtAmount}
                    onChangeText={setDebtAmount}
                    keyboardType="decimal-pad"
                    placeholder="About how much?"
                    placeholderTextColor="rgba(255,255,255,0.62)"
                    style={s.input}
                  />
                  <TextInput
                    value={debtNotes}
                    onChangeText={setDebtNotes}
                    placeholder="Any notes? (optional)"
                    placeholderTextColor="rgba(255,255,255,0.62)"
                    style={s.input}
                  />
                </>
              ) : null}
            </>
          ) : null}

          <View style={s.footerRow}>
            {step < 5 ? (
              <Pressable
                onPress={async () => {
                  try {
                    setSaving(true);
                    await saveDraft();
                    setStep((prev) => Math.min(5, prev + 1));
                  } catch (err: unknown) {
                    Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                style={[s.primaryBtn, saving && s.disabled]}
              >
                {saving ? (
                  <ActivityIndicator color={EXPENSES_TOTAL_BLUE} />
                ) : (
                  <Text style={s.primaryText}>{step === 0 ? "Let’s go" : "Next"}</Text>
                )}
              </Pressable>
            ) : (
              <Pressable onPress={finish} disabled={saving} style={[s.primaryBtn, saving && s.disabled]}>
                {saving ? <ActivityIndicator color={EXPENSES_TOTAL_BLUE} /> : <Text style={s.primaryText}>Finish</Text>}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EXPENSES_TOTAL_BLUE },
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
  welcome: { color: "#ffffff", fontSize: 26, fontWeight: "900", letterSpacing: -0.4, textAlign: "center" },
  sub: { color: "rgba(255,255,255,0.78)", marginTop: 10, fontSize: 13, fontWeight: "800", textAlign: "center", maxWidth: 360 },
  form: { gap: 10 },
  questionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  question: { color: "#ffffff", fontSize: 16, fontWeight: "900", flexShrink: 1 },
  option: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  optionActive: {
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,255,255,0.18)",
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
  },
  chipActive: {
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  chipText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#ffffff" },
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
  infoCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: T.accent,
  },
  infoCardText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
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
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  primaryText: { color: EXPENSES_TOTAL_BLUE, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
