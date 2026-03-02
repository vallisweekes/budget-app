import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { OnboardingProfile, OnboardingStatusResponse, Settings } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

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

function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

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
  const [currency, setCurrency] = useState<string | null>("GBP");

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
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [occupationOther, setOccupationOther] = useState(profile?.occupationOther ?? "");
  const [payDay, setPayDay] = useState(String(profile?.payDay ?? ""));
  const [showPayDayPicker, setShowPayDayPicker] = useState(false);
  const [selectedPayDate, setSelectedPayDate] = useState<Date | null>(() => {
    const raw = Number(profile?.payDay ?? 0);
    if (!Number.isFinite(raw) || raw < 1 || raw > 31) return null;
    return new Date(new Date().getFullYear(), new Date().getMonth(), Math.trunc(raw));
  });
  const [payFrequency, setPayFrequency] = useState<"monthly" | "every_2_weeks" | "weekly">(
    profile?.payFrequency === "weekly" || profile?.payFrequency === "every_2_weeks" ? profile.payFrequency : "monthly"
  );
  const [billFrequency, setBillFrequency] = useState<"monthly" | "every_2_weeks">(
    profile?.billFrequency === "every_2_weeks" ? "every_2_weeks" : "monthly"
  );
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

  const payDayNumber = useMemo(() => {
    const value = Number(payDay);
    if (!Number.isFinite(value)) return null;
    return Math.max(1, Math.min(31, Math.trunc(value)));
  }, [payDay]);

  const payDayPickerDate = useMemo(() => {
    if (selectedPayDate) return selectedPayDate;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [selectedPayDate]);

  const [draftPayDate, setDraftPayDate] = useState<Date>(payDayPickerDate);

  const openPayDayPicker = () => {
    setDraftPayDate(payDayPickerDate);
    setShowPayDayPicker(true);
  };

  const closePayDayPicker = () => {
    setShowPayDayPicker(false);
  };

  const confirmPayDayPicker = () => {
    setSelectedPayDate(draftPayDate);
    setPayDay(String(draftPayDate.getDate()));
    setShowPayDayPicker(false);
  };

  const onPayDayChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPayDayPicker(false);
      if (event.type !== "set" || !selectedDate) return;
      setSelectedPayDate(selectedDate);
      setPayDay(String(selectedDate.getDate()));
      return;
    }
    if (event.type !== "set" || !selectedDate) return;
    setDraftPayDate(selectedDate);
  };

  const payload: Partial<OnboardingProfile> = {
    mainGoal: mainGoals[0] ?? null,
    mainGoals,
    occupation,
    occupationOther,
    payDay: payDay ? Math.max(1, Math.min(31, Number(payDay))) : null,
    payFrequency,
    billFrequency,
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

  const hasAllBillNames =
    expenseOneName.trim().length > 0 &&
    expenseTwoName.trim().length > 0 &&
    expenseThreeName.trim().length > 0 &&
    expenseFourName.trim().length > 0;

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
              {GOALS.map((goal) => {
                const isSelected = mainGoals.includes(goal.id);
                return (
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
                <Text style={s.question}>What day of the month do you usually get paid?</Text>
              </View>
              <Pressable
                onPress={openPayDayPicker}
                style={s.input}
                accessibilityRole="button"
                accessibilityLabel="Select payday date"
              >
                <View style={s.calendarInputRow}>
                  <Ionicons name="calendar-outline" size={18} color="#ffffff" />
                  <Text style={selectedPayDate ? s.calendarInputText : s.calendarInputPlaceholder}>
                    {selectedPayDate ? formatDateDDMMYYYY(selectedPayDate) : "DD/MM/YYYY"}
                  </Text>
                </View>
              </Pressable>
              {showPayDayPicker ? (
                <View style={s.payDayPickerWrap}>
                  <DateTimePicker
                    value={payDayPickerDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onPayDayChange}
                    {...(Platform.OS === "ios"
                      ? {
                          textColor: "#ffffff",
                          accentColor: "#ffffff",
                          themeVariant: "dark" as const,
                        }
                      : {})}
                  />
                </View>
              ) : null}

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
                      onPress={() => setPayFrequency(item.id as "monthly" | "every_2_weeks" | "weekly")}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
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
                      onPress={() => setBillFrequency(item.id as "monthly" | "every_2_weeks")}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.question}>About how much do you bring in each month?</Text>
              <MoneyInput
                currency={currency}
                value={salary}
                onChangeValue={setSalary}
                variant="light"
                placeholder="0.00"
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
                <MoneyInput currency={currency} value={expenseOneAmount} onChangeValue={setExpenseOneAmount} variant="light" placeholder="0.00" containerStyle={s.rowInput} />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseTwoName}
                  onChangeText={setExpenseTwoName}
                  placeholder="Electricity, water"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput currency={currency} value={expenseTwoAmount} onChangeValue={setExpenseTwoAmount} variant="light" placeholder="0.00" containerStyle={s.rowInput} />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseThreeName}
                  onChangeText={setExpenseThreeName}
                  placeholder="Phone bill"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput currency={currency} value={expenseThreeAmount} onChangeValue={setExpenseThreeAmount} variant="light" placeholder="0.00" containerStyle={s.rowInput} />
              </View>
              <View style={s.row}>
                <TextInput
                  value={expenseFourName}
                  onChangeText={setExpenseFourName}
                  placeholder="Subscription"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={[s.input, s.rowInput]}
                />
                <MoneyInput currency={currency} value={expenseFourAmount} onChangeValue={setExpenseFourAmount} variant="light" placeholder="0.00" containerStyle={s.rowInput} />
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
                <MoneyInput currency={currency} value={allowanceAmount} onChangeValue={setAllowanceAmount} variant="light" placeholder="0.00" />
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
                  <MoneyInput currency={currency} value={debtAmount} onChangeValue={setDebtAmount} variant="light" placeholder="0.00" />
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
                    if (step === 3 && !hasAllBillNames) {
                      Alert.alert("Add bill names", "Please add a name for each bill before continuing.");
                      return;
                    }
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

      {Platform.OS === "ios" ? (
        <Modal
          visible={showPayDayPicker}
          animationType="slide"
          transparent
          onRequestClose={closePayDayPicker}
        >
          <Pressable style={s.payDayModalBackdrop} onPress={closePayDayPicker} />
          <View style={s.payDayModalSheet}>
            <View style={s.payDayModalHeader}>
              <Pressable onPress={closePayDayPicker} hitSlop={8}>
                <Text style={s.payDayModalAction}>Cancel</Text>
              </Pressable>
              <Text style={s.payDayModalTitle}>Select date</Text>
              <Pressable onPress={confirmPayDayPicker} hitSlop={8}>
                <Text style={s.payDayModalAction}>Done</Text>
              </Pressable>
            </View>
            <View style={s.payDayPickerWrap}>
              <DateTimePicker
                value={draftPayDate}
                mode="date"
                display="spinner"
                onChange={onPayDayChange}
                textColor="#ffffff"
                accentColor="#ffffff"
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      ) : null}
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
  calendarInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  calendarInputText: { color: "#ffffff", fontWeight: "800" },
  calendarInputPlaceholder: { color: "rgba(255,255,255,0.62)", fontWeight: "700" },
  payDayPickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    paddingVertical: 2,
  },
  payDayModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  payDayModalSheet: {
    backgroundColor: EXPENSES_TOTAL_BLUE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.20)",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  payDayModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  payDayModalTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  payDayModalAction: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
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
