import type { PayFrequency } from "@/lib/payPeriods";
import { suggestCategoryNameForExpense } from "@/lib/expenses/expenseCategorizer";
import { getExpensePeriodKey, getIncomePeriodKey } from "@/lib/helpers/periodKey";
import { prisma } from "@/lib/prisma";

import type { ExpenseSeedInput, OnboardingProfileRecord, SeedPeriod } from "./types";
import { cleanText } from "./utils";

type ExpenseProfileFields = Pick<OnboardingProfileRecord,
  "expenseOneName" | "expenseOneAmount"
  | "expenseTwoName" | "expenseTwoAmount"
  | "expenseThreeName" | "expenseThreeAmount"
  | "expenseFourName" | "expenseFourAmount"
>;

function rawExpenseSeeds(profile: ExpenseProfileFields) {
  return [
    { name: profile.expenseOneName, amount: Number(profile.expenseOneAmount ?? 0), fallbackName: "Bill 1" },
    { name: profile.expenseTwoName, amount: Number(profile.expenseTwoAmount ?? 0), fallbackName: "Bill 2" },
    { name: profile.expenseThreeName, amount: Number(profile.expenseThreeAmount ?? 0), fallbackName: "Bill 3" },
    { name: profile.expenseFourName, amount: Number(profile.expenseFourAmount ?? 0), fallbackName: "Bill 4" },
  ];
}

export function buildExpenseSeedInputs(profile: ExpenseProfileFields): ExpenseSeedInput[] {
  return rawExpenseSeeds(profile).filter((item) => item.amount > 0).map((item) => ({ name: cleanText(item.name) || item.fallbackName, amount: item.amount }));
}

export async function resolveCategorizedExpenseSeeds(params: { budgetPlanId: string; profile: ExpenseProfileFields }) {
  const categories = await prisma.category.findMany({ where: { budgetPlanId: params.budgetPlanId }, select: { id: true, name: true } });
  const availableCategoryNames = categories.map((category) => category.name);
  const categoryIdByLowerName = new Map(categories.map((category) => [category.name.toLowerCase(), category.id] as const));
  const resolved = await Promise.all(rawExpenseSeeds(params.profile).map(async (item) => {
    if (item.amount <= 0) return null;
    const name = cleanText(item.name) || item.fallbackName;
    const suggestedName = await suggestCategoryNameForExpense({ expenseName: name, availableCategories: availableCategoryNames });
    return { name, amount: item.amount, categoryId: suggestedName ? categoryIdByLowerName.get(suggestedName.toLowerCase()) ?? null : null };
  }));
  return resolved.filter((item): item is ExpenseSeedInput & { categoryId: string | null } => item !== null);
}

export async function buildIncomeSeedRows(params: {
  budgetPlanId: string;
  seededIncomePeriods: SeedPeriod[];
  salary: number;
  payDay: number;
  payFrequency: PayFrequency;
  payAnchorDate: Date | null;
}) {
  if (params.salary <= 0) return [] as Array<{ budgetPlanId: string; name: string; amount: number; month: number; year: number; periodKey: string }>;
  const existing = await prisma.income.findMany({ where: { budgetPlanId: params.budgetPlanId, OR: params.seededIncomePeriods.map((period) => ({ month: period.month, year: period.year })) }, select: { month: true, year: true } });
  const existingKeys = new Set(existing.map((income) => `${income.year}-${income.month}`));
  return params.seededIncomePeriods.filter((period) => !existingKeys.has(`${period.year}-${period.month}`)).map((period) => ({
    budgetPlanId: params.budgetPlanId,
    name: "Salary",
    amount: params.salary,
    month: period.month,
    year: period.year,
    periodKey: getIncomePeriodKey({ year: period.year, month: period.month }, params.payDay, params.payFrequency, params.payAnchorDate),
  }));
}

export async function buildExpenseSeedRows(params: {
  budgetPlanId: string;
  seededExpensePeriods: SeedPeriod[];
  expenseSeeds: ExpenseSeedInput[];
  payDay: number | null;
  payFrequency: PayFrequency;
  payAnchorDate: Date | null;
}) {
  const candidates = params.seededExpensePeriods.flatMap((period) => params.expenseSeeds.map((item) => {
    const dueDate = params.payDay ? new Date(Date.UTC(period.year, period.month - 1, Math.min(params.payDay, new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()))) : null;
    return {
      key: `${period.year}-${period.month}-${item.name}`,
      data: {
        budgetPlanId: params.budgetPlanId,
        name: item.name,
        amount: item.amount,
        month: period.month,
        year: period.year,
        dueDate,
        paid: false,
        paidAmount: 0,
        isAllocation: false,
        categoryId: item.categoryId ?? undefined,
        periodKey: getExpensePeriodKey({ dueDate, year: period.year, month: period.month }, params.payDay ?? 1, params.payFrequency, params.payAnchorDate),
      },
    };
  }));
  if (candidates.length === 0) return [] as Array<typeof candidates[number]["data"]>;

  const existing = await prisma.expense.findMany({
    where: { budgetPlanId: params.budgetPlanId, OR: candidates.map((item) => ({ month: item.data.month, year: item.data.year, name: item.data.name })) },
    select: { month: true, year: true, name: true },
  });
  const existingKeys = new Set(existing.map((expense) => `${expense.year}-${expense.month}-${expense.name}`));
  return candidates.filter((item) => !existingKeys.has(item.key)).map((item) => item.data);
}