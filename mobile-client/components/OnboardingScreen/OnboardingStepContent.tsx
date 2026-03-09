import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import MoneyInput from "@/components/Shared/MoneyInput";
import NoteBadge from "@/components/Shared/NoteBadge";
import { onboardingStyles as styles } from "@/components/OnboardingScreen/style";
import { BILL_FREQUENCY_OPTIONS, EXPENSES_TOTAL_BLUE, GOALS, ICON_COLORS, PAY_FREQUENCY_OPTIONS, PLANNING_YEARS_OPTIONS, STEP_ICON_COLORS } from "@/lib/constants";
import { T } from "@/lib/theme";
import type { OnboardingStepContentProps } from "@/types";

export function OnboardingStepContent({ controller }: OnboardingStepContentProps) {
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
            <Text style={styles.question}>What kind of work do you do?</Text>
          </View>
          <View style={styles.chipsWrap}>
            {controller.occupations.map((item) => {
              const active = controller.occupation === item;
              return (
                <Pressable key={item} onPress={() => controller.setOccupation(item)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
          {controller.occupation === "Other" ? (
            <TextInput
              value={controller.occupationOther}
              onChangeText={controller.setOccupationOther}
              placeholder="Your occupation"
              placeholderTextColor="rgba(255,255,255,0.62)"
              style={styles.input}
            />
          ) : null}
        </>
      ) : null}

      {controller.step === 2 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="wallet-outline" size={20} color={STEP_ICON_COLORS[2]} />
            <Text style={styles.question}>What day of the month do you usually get paid?</Text>
          </View>
          <TextInput
            value={controller.payDay}
            onChangeText={controller.setPayDay}
            placeholder="For example: 15"
            placeholderTextColor="rgba(255,255,255,0.62)"
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="Enter your payday as a day of the month"
          />
          <Text style={styles.helper}>Enter just the day number, from 1 to 31.</Text>

          <Text style={styles.question}>How often do you get paid?</Text>
          <View style={styles.chipsWrap}>
            {PAY_FREQUENCY_OPTIONS.map((item) => {
              const active = controller.payFrequency === item.value;
              return (
                <Pressable key={item.value} onPress={() => controller.setPayFrequency(item.value)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

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

          <Text style={styles.question}>About how much do you bring in each month?</Text>
          <MoneyInput currency={controller.currency} value={controller.salary} onChangeValue={controller.setSalary} variant="light" placeholder="0.00" />

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
        </>
      ) : null}

      {controller.step === 3 ? (
        <>
          <View style={styles.questionRow}>
            <Ionicons name="receipt-outline" size={20} color={STEP_ICON_COLORS[3]} />
            <Text style={styles.question}>What are the 4 bills you pay every month?</Text>
          </View>
          <View style={styles.row}>
            <TextInput value={controller.expenseOneName} onChangeText={controller.setExpenseOneName} placeholder="Rent, mortgage" placeholderTextColor="rgba(255,255,255,0.62)" style={[styles.input, styles.rowInput]} />
            <MoneyInput currency={controller.currency} value={controller.expenseOneAmount} onChangeValue={controller.setExpenseOneAmount} variant="light" placeholder="0.00" containerStyle={styles.rowInput} />
          </View>
          <View style={styles.row}>
            <TextInput value={controller.expenseTwoName} onChangeText={controller.setExpenseTwoName} placeholder="Groceries, Dining" placeholderTextColor="rgba(255,255,255,0.62)" style={[styles.input, styles.rowInput]} />
            <MoneyInput currency={controller.currency} value={controller.expenseTwoAmount} onChangeValue={controller.setExpenseTwoAmount} variant="light" placeholder="0.00" containerStyle={styles.rowInput} />
          </View>
          <View style={styles.row}>
            <TextInput value={controller.expenseThreeName} onChangeText={controller.setExpenseThreeName} placeholder="EE, Vodafone" placeholderTextColor="rgba(255,255,255,0.62)" style={[styles.input, styles.rowInput]} />
            <MoneyInput currency={controller.currency} value={controller.expenseThreeAmount} onChangeValue={controller.setExpenseThreeAmount} variant="light" placeholder="0.00" containerStyle={styles.rowInput} />
          </View>
          <View style={styles.row}>
            <TextInput value={controller.expenseFourName} onChangeText={controller.setExpenseFourName} placeholder="Netflix, Spotify" placeholderTextColor="rgba(255,255,255,0.62)" style={[styles.input, styles.rowInput]} />
            <MoneyInput currency={controller.currency} value={controller.expenseFourAmount} onChangeValue={controller.setExpenseFourAmount} variant="light" placeholder="0.00" containerStyle={styles.rowInput} />
          </View>
          <NoteBadge text="These are your regular monthly bills. If you know the company name, enter it (it helps keep things accurate)." accentStyle={{ backgroundColor: T.red, width: 8 }} />
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
            <Ionicons name="card-outline" size={20} color={STEP_ICON_COLORS[5]} />
            <Text style={styles.question}>Do you have any debts you want to pay down?</Text>
          </View>
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
              <Text style={styles.helper}>Choose yes if you want debt tracking turned on. You can change this later in Settings.</Text>
              <MoneyInput currency={controller.currency} value={controller.debtAmount} onChangeValue={controller.setDebtAmount} variant="light" placeholder="0.00" />
              <TextInput value={controller.debtNotes} onChangeText={controller.setDebtNotes} placeholder="Any notes? (optional)" placeholderTextColor="rgba(255,255,255,0.62)" style={styles.input} />
            </>
          ) : null}

          <Text style={styles.question}>Savings goal amount (for your projection)</Text>
          <MoneyInput currency={controller.currency} value={controller.savingsGoalAmount} onChangeValue={controller.setSavingsGoalAmount} variant="light" placeholder="0.00" />

          <Text style={styles.question}>What year do you want to hit that goal?</Text>
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