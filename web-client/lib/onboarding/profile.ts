import { prisma } from "@/lib/prisma";

import { EMPTY_ONBOARDING_PROFILE, type DerivedExpenseCandidate, type NormalizedOnboardingProfile, type OnboardingProfileRecord } from "./types";
import {
  clampIntRange,
  clampPayDay,
  cleanPayAnchorDate,
  cleanText,
  isPotentialLegacyExpenseSchemaError,
  toNullableNumber,
  toPositiveAmount,
} from "./utils";

export function normalizeReturnedProfile(source: NormalizedOnboardingProfile): NormalizedOnboardingProfile {
  const occupation = source.occupation ?? "Other";
  return {
    ...source,
    occupation,
    occupationOther: occupation === "Other" ? (source.occupationOther ?? "Other") : source.occupationOther,
  };
}

export function mapStoredProfile(profile: OnboardingProfileRecord): NormalizedOnboardingProfile {
  return {
    mainGoal: profile.mainGoal,
    mainGoals: Array.isArray(profile.mainGoals) && profile.mainGoals.length ? profile.mainGoals : profile.mainGoal ? [profile.mainGoal] : [],
    occupation: profile.occupation,
    occupationOther: profile.occupationOther,
    payDay: toNullableNumber(profile.payDay),
    payAnchorDate: cleanPayAnchorDate(profile.payAnchorDate)?.toISOString() ?? null,
    payFrequency: profile.payFrequency,
    billFrequency: profile.billFrequency,
    monthlySalary: toNullableNumber(profile.monthlySalary),
    planningYears: toNullableNumber(profile.planningYears),
    savingsGoalAmount: toNullableNumber(profile.savingsGoalAmount),
    savingsGoalYear: toNullableNumber(profile.savingsGoalYear),
    expenseOneName: profile.expenseOneName,
    expenseOneAmount: toNullableNumber(profile.expenseOneAmount),
    expenseTwoName: profile.expenseTwoName,
    expenseTwoAmount: toNullableNumber(profile.expenseTwoAmount),
    expenseThreeName: profile.expenseThreeName,
    expenseThreeAmount: toNullableNumber(profile.expenseThreeAmount),
    expenseFourName: profile.expenseFourName,
    expenseFourAmount: toNullableNumber(profile.expenseFourAmount),
    hasAllowance: profile.hasAllowance,
    allowanceAmount: toNullableNumber(profile.allowanceAmount),
    hasDebtsToManage: profile.hasDebtsToManage,
    debtAmount: toNullableNumber(profile.debtAmount),
    debtNotes: profile.debtNotes,
  };
}

export function mergeMissingProfileFields(
  base: NormalizedOnboardingProfile,
  fallback: NormalizedOnboardingProfile,
): NormalizedOnboardingProfile {
  const merged = { ...base };
  for (const key of Object.keys(fallback) as Array<keyof NormalizedOnboardingProfile>) {
    const current = merged[key];
    const next = fallback[key];
    const shouldReplace = current == null
      || (typeof current === "string" && current.trim().length === 0)
      || (Array.isArray(current) && current.length === 0);
    if (shouldReplace && next != null) merged[key] = next as never;
  }
  return merged;
}

function isIgnoredLegacyExpenseName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return !normalized || [
    "allowance", "saving", "savings", "groceries", "lunch", "barber", "barbers",
    "carry over", "spending money", "cash",
  ].some((token) => normalized.includes(token));
}

function isIgnoredLegacyDebtName(name: string): boolean {
  return name.trim().toLowerCase().startsWith("savings:");
}

function compareDerivedExpenseCandidates(a: DerivedExpenseCandidate, b: DerivedExpenseCandidate): number {
  const score = (candidate: DerivedExpenseCandidate) => {
    const recurrence = Math.min(candidate.count, 12) * 10;
    const dueDate = candidate.hasDueDate ? 6 : 0;
    const directDebit = candidate.isDirectDebit ? 3 : 0;
    const amount = candidate.amount >= 500 ? 5 : candidate.amount >= 100 ? 4 : candidate.amount >= 25 ? 2 : candidate.amount >= 10 ? 1 : 0;
    return recurrence + dueDate + directDebit + amount;
  };
  return score(b) - score(a) || b.latestYear - a.latestYear || b.latestMonth - a.latestMonth || b.amount - a.amount;
}

export async function deriveLegacyOnboardingProfile(
  userId: string,
  preferredPlanId: string | null,
): Promise<NormalizedOnboardingProfile> {
  if (!preferredPlanId) return EMPTY_ONBOARDING_PROFILE;

  const expensesPromise = (async () => {
    try {
      return await prisma.expense.findMany({
        where: { budgetPlanId: preferredPlanId, isAllocation: false, isMovedToDebt: false, isExtraLoggedExpense: false },
        select: { name: true, amount: true, dueDate: true, isDirectDebit: true, month: true, year: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 400,
      });
    } catch (error) {
      if (!isPotentialLegacyExpenseSchemaError(error)) throw error;
      try {
        return await prisma.expense.findMany({
          where: { budgetPlanId: preferredPlanId },
          select: { name: true, amount: true, dueDate: true, month: true, year: true },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 400,
        });
      } catch (fallbackError) {
        if (!isPotentialLegacyExpenseSchemaError(fallbackError)) throw fallbackError;
        return prisma.expense.findMany({
          where: { budgetPlanId: preferredPlanId },
          select: { name: true, amount: true, month: true, year: true },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 400,
        });
      }
    }
  })();

  const [plan, incomes, expenses, debts] = await Promise.all([
    prisma.budgetPlan.findUnique({ where: { id: preferredPlanId }, select: { payDate: true, monthlyAllowance: true, budgetHorizonYears: true } }),
    prisma.income.findMany({ where: { budgetPlanId: preferredPlanId }, select: { name: true, amount: true, month: true, year: true }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 }),
    expensesPromise,
    prisma.debt.findMany({ where: { budgetPlanId: preferredPlanId, paid: false }, select: { name: true, currentBalance: true } }),
  ]);

  const salaryEntries = incomes.filter((income) => /salary/i.test(income.name ?? ""));
  const recurringSalaryAmount = new Set(salaryEntries.map((income) => `${income.year}-${income.month}`)).size >= 3 ? toPositiveAmount(salaryEntries[0]?.amount) : null;
  const expenseCandidates = new Map<string, DerivedExpenseCandidate>();
  for (const expense of expenses) {
    const name = cleanText(expense.name);
    const amount = toPositiveAmount(expense.amount);
    if (!name || amount == null || isIgnoredLegacyExpenseName(name)) continue;
    const key = `${name}::${amount.toFixed(2)}`;
    const existing = expenseCandidates.get(key);
    if (existing) {
      existing.count += 1;
      existing.hasDueDate ||= "dueDate" in expense ? Boolean(expense.dueDate) : false;
      existing.isDirectDebit ||= "isDirectDebit" in expense ? Boolean(expense.isDirectDebit) : false;
      if (expense.year > existing.latestYear || (expense.year === existing.latestYear && expense.month > existing.latestMonth)) {
        existing.latestYear = expense.year;
        existing.latestMonth = expense.month;
      }
      continue;
    }
    expenseCandidates.set(key, {
      name,
      amount,
      count: 1,
      hasDueDate: "dueDate" in expense ? Boolean(expense.dueDate) : false,
      isDirectDebit: "isDirectDebit" in expense ? Boolean(expense.isDirectDebit) : false,
      latestYear: expense.year,
      latestMonth: expense.month,
    });
  }

  const recurringBills = Array.from(expenseCandidates.values()).filter((candidate) => candidate.count >= 3).sort(compareDerivedExpenseCandidates).slice(0, 4);
  const activeDebts = debts.filter((debt) => !isIgnoredLegacyDebtName(debt.name));
  const totalDebtAmount = activeDebts.reduce((sum, debt) => sum + (toPositiveAmount(debt.currentBalance) ?? 0), 0);
  const allowanceAmount = toPositiveAmount(plan?.monthlyAllowance);

  return {
    ...EMPTY_ONBOARDING_PROFILE,
    occupation: userId ? "Other" : null,
    occupationOther: userId ? "Other" : null,
    payDay: clampPayDay(plan?.payDate ?? null),
    payFrequency: recurringSalaryAmount != null ? "monthly" : null,
    billFrequency: recurringBills.length > 0 ? "monthly" : null,
    monthlySalary: recurringSalaryAmount,
    planningYears: clampIntRange(plan?.budgetHorizonYears ?? null, 1, 30),
    expenseOneName: recurringBills[0]?.name ?? null,
    expenseOneAmount: recurringBills[0]?.amount ?? null,
    expenseTwoName: recurringBills[1]?.name ?? null,
    expenseTwoAmount: recurringBills[1]?.amount ?? null,
    expenseThreeName: recurringBills[2]?.name ?? null,
    expenseThreeAmount: recurringBills[2]?.amount ?? null,
    expenseFourName: recurringBills[3]?.name ?? null,
    expenseFourAmount: recurringBills[3]?.amount ?? null,
    hasAllowance: allowanceAmount != null ? allowanceAmount > 0 : null,
    allowanceAmount,
    hasDebtsToManage: activeDebts.length > 0 ? true : null,
    debtAmount: totalDebtAmount > 0 ? Number(totalDebtAmount.toFixed(2)) : null,
  };
}