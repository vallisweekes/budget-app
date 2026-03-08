import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const RESET_ONBOARDING_PROFILE = {
  status: "started" as const,
  completedAt: null,
  mainGoal: null,
  mainGoals: [],
  occupation: null,
  occupationOther: null,
  payDay: null,
  payFrequency: null,
  billFrequency: null,
  monthlySalary: null,
  planningYears: null,
  savingsGoalAmount: null,
  savingsGoalYear: null,
  expenseOneName: null,
  expenseOneAmount: null,
  expenseTwoName: null,
  expenseTwoAmount: null,
  expenseThreeName: null,
  expenseThreeAmount: null,
  expenseFourName: null,
  expenseFourAmount: null,
  hasAllowance: null,
  allowanceAmount: null,
  hasDebtsToManage: null,
  debtAmount: null,
  debtNotes: null,
  generatedPlanId: null,
};

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const [budgetPlans, categories, income, expenses, debts, goals, allocations, allocationItems, allocationMonths, snapshots, receipts] = await Promise.all([
      prisma.budgetPlan.count({ where: { userId } }),
      prisma.category.count({ where: { budgetPlan: { userId } } }),
      prisma.income.count({ where: { budgetPlan: { userId } } }),
      prisma.expense.count({ where: { budgetPlan: { userId } } }),
      prisma.debt.count({ where: { budgetPlan: { userId } } }),
      prisma.goal.count({ where: { budgetPlan: { userId } } }),
      prisma.allocationDefinition.count({ where: { budgetPlan: { userId } } }),
      prisma.monthlyAllocationItem.count({ where: { budgetPlan: { userId } } }),
      prisma.monthlyAllocation.count({ where: { budgetPlan: { userId } } }),
      prisma.expenseSummarySnapshot.count({ where: { budgetPlan: { userId } } }),
      prisma.receipt.count({ where: { userId } }),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.receipt.deleteMany({ where: { userId } });
      await tx.budgetPlan.deleteMany({ where: { userId } });
      await tx.userOnboardingProfile.upsert({
        where: { userId },
        create: { userId, ...RESET_ONBOARDING_PROFILE },
        update: RESET_ONBOARDING_PROFILE,
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          isOnboarded: false,
          navStateJson: null,
          navStateUpdatedAt: null,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      removed: {
        budgetPlans,
        categories,
        income,
        expenses,
        debts,
        goals,
        allocations,
        allocationItems,
        allocationMonths,
        snapshots,
        receipts,
      },
      next: { onboardingRequiredOnNextSignIn: true },
    });
  } catch (error) {
    console.error("Failed to reset account data:", error);
    return NextResponse.json({ error: "Failed to reset account data" }, { status: 500 });
  }
}