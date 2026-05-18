import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import MoneyInput from "@/components/Shared/MoneyInput";
import NoteBadge from "@/components/Shared/NoteBadge";
import OnboardingPayScheduleSection from "@/components/OnboardingScreen/OnboardingPayScheduleSection";
import { onboardingStyles as styles } from "@/components/OnboardingScreen/style";
import { BILL_FREQUENCY_OPTIONS, EXPENSES_TOTAL_BLUE, GOALS, ICON_COLORS, PLANNING_YEARS_OPTIONS, STEP_ICON_COLORS } from "@/lib/constants";
import type { OnboardingStepContentProps } from "@/types";

export function OnboardingStepContent({ controller }: OnboardingStepContentProps) {
  const [occupationDropdownOpen, setOccupationDropdownOpen] = useState(false);

  useEffect(() => {
    if (controller.step !== 1 && occupationDropdownOpen) {
      setOccupationDropdownOpen(false);
    }
  }, [controller.step, occupationDropdownOpen]);

  const selectedOccupationLabel = useMemo(() => {
    const value = controller.occupation.trim();
    return value.length > 0 ? value : "Select occupation";
  }, [controller.occupation]);

  const normalizedOccupation = controller.occupation.trim().toLowerCase();
  const occupationNeedsIncomeSource = controller.incomeSourceOptions.length > 0;
  const occupationNeedsCustomLabel = normalizedOccupation === "other";
  const monthlyBillRows = [
    {
      key: "expense-one",
      title: "Housing",
      helper: "Rent, mortgage",
      name: controller.expenseOneName,
      setName: controller.setExpenseOneName,
      amount: controller.expenseOneAmount,
      setAmount: controller.setExpenseOneAmount,
    },
    {
      key: "expense-two",
      title: "Food",
      helper: "Groceries, Dining",
      name: controller.expenseTwoName,
      setName: controller.setExpenseTwoName,
      amount: controller.expenseTwoAmount,
      setAmount: controller.setExpenseTwoAmount,
    },
    {
      key: "expense-three",
      title: "Utilities",
      helper: "EE, Vodafone",
      name: controller.expenseThreeName,
      setName: controller.setExpenseThreeName,
      amount: controller.expenseThreeAmount,
      setAmount: controller.setExpenseThreeAmount,
    },
    {
      key: "expense-four",
      title: "Subscriptions",
      helper: "Netflix, Spotify",
      name: controller.expenseFourName,
      setName: controller.setExpenseFourName,
      amount: controller.expenseFourAmount,
      setAmount: controller.setExpenseFourAmount,
    },
  ];

  return (
    <>
      {controller.step === 0 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="sparkles-outline" size={20} color={STEP_ICON_COLORS[0]} />
            <Text style={styles.question}>What do you want help with most right now?</Text>
          </View>
          {GOALS.map((goal) => {
            const isSelected = controller.mainGoals.includes(goal.id);
            return (
              <Pressable key={goal.id} onPress={() => controller.toggleGoal(goal.id)} style={[styles.option, isSelected && styles.optionActive]}>
                <View style={styles.optionRow}>
                  <View style={styles.optionLeft}>
                    <Ionicons name={goal.icon} size={18} color={ICON_COLORS[goal.id]} />
                    <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{goal.label}</Text>
                  </View>
                  <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={20} color="#ffffff" />
                </View>
              </Pressable>
            );
          })}
          <Text style={styles.helper}>You can pick more than one.</Text>
        </>
      ) : null}

      {controller.step === 1 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="briefcase-outline" size={20} color={STEP_ICON_COLORS[1]} />
            <Text style={styles.question}>What's your occupation?</Text>
          </View>

          <Pressable
            onPress={() => setOccupationDropdownOpen((value) => !value)}
            style={[styles.dropdownTrigger, occupationDropdownOpen && styles.dropdownTriggerOpen]}
            accessibilityRole="button"
            accessibilityLabel="Open occupation list"
          >
            <Text
              style={[
                styles.dropdownTriggerText,
                !controller.occupation.trim() && styles.dropdownTriggerPlaceholder,
              ]}
            >
              {selectedOccupationLabel}
            </Text>
            <Ionicons
              name={occupationDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#ffffff"
            />
          </Pressable>

          {occupationDropdownOpen ? (
            <View style={styles.dropdownList}>
              <ScrollView
                style={styles.dropdownListScroll}
                contentContainerStyle={styles.dropdownListContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {controller.occupations.map((item) => {
                  const active = controller.occupation === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        controller.setOccupation(item);
                        setOccupationDropdownOpen(false);
                      }}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    >
                      <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{item}</Text>
                      {active ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {occupationNeedsCustomLabel ? (
            <TextInput
              value={controller.occupationOther}
              onChangeText={controller.setOccupationOther}
              placeholder="Your occupation"
              placeholderTextColor="rgba(255,255,255,0.62)"
              style={styles.input}
            />
          ) : null}

          {occupationNeedsIncomeSource ? (
            <>
              <Text style={styles.question}>What's your source of income?</Text>
              <View style={styles.chipsWrap}>
                {controller.incomeSourceOptions.map((item) => {
                  const active = controller.incomeSource === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => controller.setIncomeSource(item)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {controller.incomeSource === "Other" ? (
                <TextInput
                  value={controller.incomeSourceOther}
                  onChangeText={controller.setIncomeSourceOther}
                  placeholder="Tell us your source of income"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={styles.input}
                />
              ) : null}

              <Text style={styles.helper}>Required for students, unemployed, and retired users.</Text>
            </>
          ) : null}
        </>
      ) : null}

      {controller.step === 2 ? (
        <>
          <OnboardingPayScheduleSection controller={controller} />

          <View style={styles.sectionCard}>
            <Text style={styles.question}>How often do you usually pay most bills?</Text>
            <View style={styles.chipsWrap}>
              {BILL_FREQUENCY_OPTIONS.map((item) => {
                const active = controller.billFrequency === item.value;
                return (
                  <Pressable key={item.value} onPress={() => controller.setBillFrequency(item.value)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.question}>
              {occupationNeedsIncomeSource
                ? "About how much do you receive each month?"
                : "About how much do you bring in each month after tax?"}
            </Text>
            <MoneyInput currency={controller.currency} value={controller.salary} onChangeValue={controller.setSalary} variant="light" placeholder="0.00" />
            <Text style={styles.helper}>
              {occupationNeedsIncomeSource
                ? "Use the monthly amount you receive from your selected source of income."
                : "Use your monthly take-home pay (after tax)."}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.question}>How many years ahead do you want to plan your income?</Text>
            <View style={styles.chipsWrap}>
              {PLANNING_YEARS_OPTIONS.map((item) => {
                const active = controller.planningYears === item.id;
                return (
                  <Pressable key={item.id} onPress={() => controller.setPlanningYears(item.id)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {controller.step === 3 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="receipt-outline" size={20} color={STEP_ICON_COLORS[3]} />
            <Text style={styles.question}>What are the 4 bills you pay every month?</Text>
          </View>
          <Text style={styles.questionSubtitle}>Add your biggest regular bills first so your budget forecast starts accurately.</Text>

          <View style={styles.billList}>
            {monthlyBillRows.map((bill, index) => (
              <View key={bill.key} style={styles.billCard}>
                <View style={styles.billCardHeader}>
                  <View style={styles.billIndexBadge}>
                    <Text style={styles.billIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.billMeta}>
                    <Text style={styles.billCardTitle}>{bill.title}</Text>
                    <Text style={styles.billCardHint}>{bill.helper}</Text>
                  </View>
                </View>

                <View style={styles.billInputRow}>
                  <TextInput
                    value={bill.name}
                    onChangeText={bill.setName}
                    placeholder={bill.helper}
                    placeholderTextColor="rgba(255,255,255,0.62)"
                    style={[styles.input, styles.billNameInput]}
                  />
                  <MoneyInput
                    currency={controller.currency}
                    value={bill.amount}
                    onChangeValue={bill.setAmount}
                    variant="light"
                    placeholder="0.00"
                    containerStyle={styles.billAmountInput}
                  />
                </View>
              </View>
            ))}
          </View>

          <NoteBadge
            text="These are your regular monthly bills. If you know the company name, add it to keep your plan accurate."
            containerStyle={styles.stepNoteBadge}
            textStyle={styles.stepNoteText}
            accentStyle={styles.stepNoteAccent}
          />
        </>
      ) : null}

      {controller.step === 4 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="happy-outline" size={20} color={STEP_ICON_COLORS[4]} />
            <Text style={styles.question}>Do you set aside spending money for yourself?</Text>
          </View>
          <View style={styles.toggleRow}>
            <Pressable onPress={() => controller.setHasAllowance(true)} style={[styles.toggle, controller.hasAllowance && styles.toggleActive]}>
              <Text style={[styles.toggleText, controller.hasAllowance && styles.toggleTextActive]}>Yes</Text>
            </Pressable>
            <Pressable onPress={() => controller.setHasAllowance(false)} style={[styles.toggle, !controller.hasAllowance && styles.toggleActive]}>
              <Text style={[styles.toggleText, !controller.hasAllowance && styles.toggleTextActive]}>No</Text>
            </Pressable>
          </View>
          {controller.hasAllowance ? (
            <MoneyInput currency={controller.currency} value={controller.allowanceAmount} onChangeValue={controller.setAllowanceAmount} variant="light" placeholder="0.00" />
          ) : null}
        </>
      ) : null}

      {controller.step === 5 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="sparkles-outline" size={20} color={STEP_ICON_COLORS[5]} />
            <Text style={styles.question}>Final step: set up debts and your savings goal</Text>
          </View>
          <Text style={styles.questionSubtitle}>First choose debt tracking, then set your savings target.</Text>

          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={17} color={STEP_ICON_COLORS[5]} />
            <Text style={styles.sectionHeader}>Debt setup</Text>
          </View>
          <Text style={styles.question}>Do you want to track any debts?</Text>
          <View style={styles.toggleRow}>
            <Pressable onPress={() => controller.setHasDebts(true)} style={[styles.toggle, controller.hasDebts && styles.toggleActive]}>
              <Text style={[styles.toggleText, controller.hasDebts && styles.toggleTextActive]}>Yes</Text>
            </Pressable>
            <Pressable onPress={() => controller.setHasDebts(false)} style={[styles.toggle, !controller.hasDebts && styles.toggleActive]}>
              <Text style={[styles.toggleText, !controller.hasDebts && styles.toggleTextActive]}>No</Text>
            </Pressable>
          </View>
          {controller.hasDebts ? (
            <>
              <Text style={styles.helper}>Add your current debt balance and a clear debt name.</Text>
              <MoneyInput currency={controller.currency} value={controller.debtAmount} onChangeValue={controller.setDebtAmount} variant="light" placeholder="0.00" />
              <TextInput value={controller.debtNotes} onChangeText={controller.setDebtNotes} placeholder="Debt name (e.g. Barclays card)" placeholderTextColor="rgba(255,255,255,0.62)" style={styles.input} />
            </>
          ) : (
            <Text style={styles.helper}>You can skip this for now and add debts later in settings.</Text>
          )}

          <View style={styles.sectionDivider} />

          <View style={styles.sectionHeaderRow}>
            <Ionicons name="trending-up-outline" size={17} color={STEP_ICON_COLORS[5]} />
            <Text style={styles.sectionHeader}>Savings goal</Text>
          </View>
          <Text style={[styles.helper, styles.sectionHelper]}>Set the amount and year you want to hit for your projection.</Text>

          <Text style={styles.fieldLabel}>Goal amount</Text>
          <MoneyInput currency={controller.currency} value={controller.savingsGoalAmount} onChangeValue={controller.setSavingsGoalAmount} variant="light" placeholder="0.00" />

          <Text style={styles.fieldLabel}>Target year</Text>
          <TextInput value={controller.savingsGoalYear} onChangeText={controller.setSavingsGoalYear} placeholder="e.g. 2028" placeholderTextColor="rgba(255,255,255,0.62)" keyboardType="number-pad" style={styles.input} />
        </>
      ) : null}

      <View style={styles.footerRow}>
        {controller.step < 5 ? (
          <Pressable onPress={() => void controller.onGoForwardStep()} disabled={controller.saving} style={[controller.saving ? styles.primaryBtnCircle : styles.primaryBtn, controller.saving && styles.disabled]} accessibilityRole="button" accessibilityLabel={controller.step === 0 ? "Let's go" : "Next"}>
            {controller.saving ? <ActivityIndicator color={EXPENSES_TOTAL_BLUE} /> : <Text style={styles.primaryBtnText}>{controller.step === 0 ? "Let's go" : "Next"}</Text>}
          </Pressable>
        ) : (
          <Pressable onPress={controller.onFinish} disabled={controller.saving} style={[controller.saving ? styles.primaryBtnCircle : styles.primaryBtn, controller.saving && styles.disabled]} accessibilityRole="button" accessibilityLabel="Finish">
            {controller.saving ? <ActivityIndicator color={EXPENSES_TOTAL_BLUE} /> : <Text style={styles.primaryBtnText}>Finish</Text>}
          </Pressable>
        )}
      </View>
    </>
  );
}

export default OnboardingStepContent;