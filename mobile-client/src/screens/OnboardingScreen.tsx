import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiFetch } from "@/lib/api";
import type { OnboardingProfile, OnboardingStatusResponse } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

type Goal = "improve_savings" | "manage_debts" | "track_spending";

const GOALS: Array<{ id: Goal; label: string }> = [
  { id: "improve_savings", label: "Improve savings" },
  { id: "manage_debts", label: "Manage debts better" },
  { id: "track_spending", label: "Keep general track of spending" },
];

export default function OnboardingScreen({
  initial,
  onCompleted,
}: {
  initial: OnboardingStatusResponse;
  onCompleted: () => void;
}) {
  const profile = initial.profile;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [mainGoal, setMainGoal] = useState<Goal>((profile?.mainGoal as Goal | null) ?? "improve_savings");
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(profile?.occupationOther ?? "");
  const [salary, setSalary] = useState(String(profile?.monthlySalary ?? ""));
  const [expenseOneName, setExpenseOneName] = useState(profile?.expenseOneName ?? "Rent");
  const [expenseOneAmount, setExpenseOneAmount] = useState(String(profile?.expenseOneAmount ?? ""));
  const [expenseTwoName, setExpenseTwoName] = useState(profile?.expenseTwoName ?? "Utilities");
  const [expenseTwoAmount, setExpenseTwoAmount] = useState(String(profile?.expenseTwoAmount ?? ""));
  const [hasAllowance, setHasAllowance] = useState(Boolean(profile?.hasAllowance));
  const [allowanceAmount, setAllowanceAmount] = useState(String(profile?.allowanceAmount ?? ""));
  const [hasDebts, setHasDebts] = useState(Boolean(profile?.hasDebtsToManage));
  const [debtAmount, setDebtAmount] = useState(String(profile?.debtAmount ?? ""));
  const [debtNotes, setDebtNotes] = useState(profile?.debtNotes ?? "");

  const occupations = useMemo(() => initial.occupations ?? [], [initial.occupations]);

  const payload: Partial<OnboardingProfile> = {
    mainGoal,
    occupation,
    occupationOther,
    monthlySalary: salary ? Number(salary) : null,
    expenseOneName,
    expenseOneAmount: expenseOneAmount ? Number(expenseOneAmount) : null,
    expenseTwoName,
    expenseTwoAmount: expenseTwoAmount ? Number(expenseTwoAmount) : null,
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

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.kicker}>WELCOME</Text>
        <Text style={s.title}>Thanks for coming on this journey</Text>
        <Text style={s.sub}>Answer a few quick questions and we’ll create your first personal plan automatically.</Text>

        <View style={s.card}>
          {step === 0 ? (
            <>
              <Text style={s.question}>What is your main goal?</Text>
              {GOALS.map((goal) => (
                <Pressable
                  key={goal.id}
                  onPress={() => setMainGoal(goal.id)}
                  style={[s.option, mainGoal === goal.id && s.optionActive]}
                >
                  <Text style={[s.optionText, mainGoal === goal.id && s.optionTextActive]}>{goal.label}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={s.question}>What do you do for work?</Text>
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
                  placeholderTextColor={T.textMuted}
                  style={s.input}
                />
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={s.question}>What is your monthly salary?</Text>
              <TextInput
                value={salary}
                onChangeText={setSalary}
                keyboardType="decimal-pad"
                placeholder="e.g. 2500"
                placeholderTextColor={T.textMuted}
                style={s.input}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={s.question}>What 2 expenses do you pay every month without fail?</Text>
              <View style={s.row}>
                <TextInput value={expenseOneName} onChangeText={setExpenseOneName} placeholder="Expense 1" placeholderTextColor={T.textMuted} style={[s.input, s.rowInput]} />
                <TextInput value={expenseOneAmount} onChangeText={setExpenseOneAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={T.textMuted} style={[s.input, s.rowInput]} />
              </View>
              <View style={s.row}>
                <TextInput value={expenseTwoName} onChangeText={setExpenseTwoName} placeholder="Expense 2" placeholderTextColor={T.textMuted} style={[s.input, s.rowInput]} />
                <TextInput value={expenseTwoAmount} onChangeText={setExpenseTwoAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={T.textMuted} style={[s.input, s.rowInput]} />
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={s.question}>Do you give yourself any allowance?</Text>
              <View style={s.toggleRow}>
                <Pressable onPress={() => setHasAllowance(true)} style={[s.toggle, hasAllowance && s.toggleActive]}><Text style={[s.toggleText, hasAllowance && s.toggleTextActive]}>Yes</Text></Pressable>
                <Pressable onPress={() => setHasAllowance(false)} style={[s.toggle, !hasAllowance && s.toggleActive]}><Text style={[s.toggleText, !hasAllowance && s.toggleTextActive]}>No</Text></Pressable>
              </View>
              {hasAllowance ? (
                <TextInput
                  value={allowanceAmount}
                  onChangeText={setAllowanceAmount}
                  keyboardType="decimal-pad"
                  placeholder="Allowance amount"
                  placeholderTextColor={T.textMuted}
                  style={s.input}
                />
              ) : null}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Text style={s.question}>Any debts you want to manage?</Text>
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
                    placeholder="Debt amount"
                    placeholderTextColor={T.textMuted}
                    style={s.input}
                  />
                  <TextInput
                    value={debtNotes}
                    onChangeText={setDebtNotes}
                    placeholder="Debt note (optional)"
                    placeholderTextColor={T.textMuted}
                    style={s.input}
                  />
                </>
              ) : null}
            </>
          ) : null}

          <View style={s.footerRow}>
            <Pressable
              onPress={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={step === 0 || saving}
              style={[s.secondaryBtn, (step === 0 || saving) && s.disabled]}
            >
              <Text style={s.secondaryText}>Back</Text>
            </Pressable>

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
                {saving ? <ActivityIndicator color={T.onAccent} /> : <Text style={s.primaryText}>Next</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={finish} disabled={saving} style={[s.primaryBtn, saving && s.disabled]}>
                {saving ? <ActivityIndicator color={T.onAccent} /> : <Text style={s.primaryText}>Finish</Text>}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  wrap: { paddingHorizontal: 20, paddingVertical: 24 },
  kicker: { color: T.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: T.text, fontSize: 24, fontWeight: "900", marginTop: 6 },
  sub: { color: T.textDim, marginTop: 8, marginBottom: 16, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: T.card,
    gap: 10,
  },
  question: { color: T.text, fontSize: 15, fontWeight: "800", marginBottom: 6 },
  option: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  optionActive: {
    borderColor: T.accent,
    backgroundColor: `${T.accent}22`,
  },
  optionText: { color: T.text, fontSize: 14, fontWeight: "700" },
  optionTextActive: { color: T.accent },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: T.accent,
    backgroundColor: `${T.accent}22`,
  },
  chipText: { color: T.text, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: T.accent },
  input: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.text,
  },
  row: { flexDirection: "row", gap: 10 },
  rowInput: { flex: 1 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleActive: {
    borderColor: T.accent,
    backgroundColor: `${T.accent}22`,
  },
  toggleText: { color: T.text, fontWeight: "700" },
  toggleTextActive: { color: T.accent },
  footerRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  primaryBtn: {
    minWidth: 110,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
  },
  primaryText: { color: T.onAccent, fontWeight: "800" },
  secondaryBtn: {
    minWidth: 90,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  secondaryText: { color: T.text, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
