import { prisma } from "@/lib/prisma";
import { deriveBillFrequencyFromPayFrequency } from "@/lib/payPeriods";

import { cleanGoals, normalizeSelectedGoals } from "./goals";
import type { OnboardingGoalInput, OnboardingInput } from "./types";
import {
  clampIntRange,
  clampPayDay,
  cleanPayAnchorDate,
  cleanPayFrequency,
  cleanText,
  onboardingDelegate,
  toAmount,
} from "./utils";

export async function saveOnboardingDraft(userId: string, input: OnboardingInput) {
  const existing = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!existing) await onboardingDelegate(prisma).create({ data: { userId, status: "started" } });

  const cleanedMainGoals = input.mainGoals ? (cleanGoals(input.mainGoals) ?? []) : null;
  const mainGoals = cleanedMainGoals ? normalizeSelectedGoals(cleanedMainGoals) : null;
  const derivedMainGoal: OnboardingGoalInput | null = mainGoals && mainGoals.length ? mainGoals[0] : input.mainGoal ?? null;
  const nextPayFrequency = cleanPayFrequency(input.payFrequency);
  const nextPayAnchorDate = nextPayFrequency === "monthly" ? null : cleanPayAnchorDate(input.payAnchorDate);
  const updateData: Record<string, unknown> = {
    payAnchorDate: nextPayAnchorDate,
    mainGoal: derivedMainGoal ?? undefined,
    mainGoals: mainGoals ?? undefined,
    occupation: cleanText(input.occupation),
    occupationOther: cleanText(input.occupationOther),
    payDay: nextPayFrequency === "monthly" ? clampPayDay(input.payDay) : clampPayDay(input.payDay ?? nextPayAnchorDate?.getUTCDate()),
    payFrequency: nextPayFrequency,
    billFrequency: nextPayFrequency ? deriveBillFrequencyFromPayFrequency(nextPayFrequency) : null,
    monthlySalary: toAmount(input.monthlySalary),
    planningYears: clampIntRange(input.planningYears, 1, 30),
    savingsGoalAmount: toAmount(input.savingsGoalAmount),
    savingsGoalYear: clampIntRange(input.savingsGoalYear, 2000, 2200),
    expenseOneName: cleanText(input.expenseOneName),
    expenseOneAmount: toAmount(input.expenseOneAmount),
    expenseTwoName: cleanText(input.expenseTwoName),
    expenseTwoAmount: toAmount(input.expenseTwoAmount),
    expenseThreeName: cleanText(input.expenseThreeName),
    expenseThreeAmount: toAmount(input.expenseThreeAmount),
    expenseFourName: cleanText(input.expenseFourName),
    expenseFourAmount: toAmount(input.expenseFourAmount),
    hasAllowance: input.hasAllowance ?? undefined,
    allowanceAmount: toAmount(input.allowanceAmount),
    hasDebtsToManage: input.hasDebtsToManage ?? undefined,
    debtAmount: toAmount(input.debtAmount),
    debtNotes: cleanText(input.debtNotes),
  };

  try {
    return await onboardingDelegate(prisma).update({ where: { userId }, data: updateData });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldDropMainGoals = /Unknown arg(ument)? `mainGoals`/i.test(message) || /data\.mainGoals/i.test(message);
    const shouldDropBuildBudget = /build_budget/i.test(message) && /enum|expected|invalid value/i.test(message);
    const shouldDropExtraBills = /Unknown arg(ument)? `expense(Three|Four)(Name|Amount)`/i.test(message) || /data\.expense(Three|Four)(Name|Amount)/i.test(message);
    const shouldDropPayAnchorDate = /Unknown arg(ument)? `payAnchorDate`/i.test(message) || /data\.payAnchorDate/i.test(message);
    const shouldDropPaySetup = /Unknown arg(ument)? `(payDay|payFrequency|billFrequency)`/i.test(message) || /data\.(payDay|payFrequency|billFrequency)/i.test(message);
    const shouldDropPlanningProjection = /Unknown arg(ument)? `(planningYears|savingsGoalAmount|savingsGoalYear)`/i.test(message) || /data\.(planningYears|savingsGoalAmount|savingsGoalYear)/i.test(message);
    if (!shouldDropMainGoals && !shouldDropBuildBudget && !shouldDropExtraBills && !shouldDropPayAnchorDate && !shouldDropPaySetup && !shouldDropPlanningProjection) throw error;

    const retryData: Record<string, unknown> = { ...updateData };
    if (shouldDropMainGoals) delete retryData.mainGoals;
    if (shouldDropExtraBills) {
      delete retryData.expenseThreeName;
      delete retryData.expenseThreeAmount;
      delete retryData.expenseFourName;
      delete retryData.expenseFourAmount;
    }
    if (shouldDropPayAnchorDate) delete retryData.payAnchorDate;
    if (shouldDropPaySetup) {
      delete retryData.payDay;
      delete retryData.payFrequency;
      delete retryData.billFrequency;
    }
    if (shouldDropPlanningProjection) {
      delete retryData.planningYears;
      delete retryData.savingsGoalAmount;
      delete retryData.savingsGoalYear;
    }
    if (shouldDropBuildBudget) {
      if (retryData.mainGoal === "build_budget") delete retryData.mainGoal;
      if (Array.isArray(retryData.mainGoals)) {
        const filtered = (retryData.mainGoals as unknown[]).filter((goal) => goal !== "build_budget");
        retryData.mainGoals = filtered;
        if (!filtered.length) delete retryData.mainGoals;
      }
    }
    return onboardingDelegate(prisma).update({ where: { userId }, data: retryData });
  }
}