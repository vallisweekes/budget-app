import { ensureUkMobileProviderMappingsSeeded } from "@/lib/expenses/providerMappings";
import { normalizePayFrequency, resolveFirstSelectablePayPeriodWindow } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";

import { normalizeSelectedGoals, syncGeneratedGoals } from "./goals";
import { buildForwardSeedMonths, buildForwardSeedPeriodsFromMonth, ensurePersonalPlan, getBudgetHorizonTargetYear } from "./seed";
import { buildExpenseSeedRows, buildIncomeSeedRows, resolveCategorizedExpenseSeeds } from "./seedData";
import type { OnboardingGoalInput } from "./types";
import { clampIntRange, clampPayDay, cleanPayAnchorDate, isPrismaValidationError, latestDate, onboardingDelegate, toNullableNumber } from "./utils";

async function markUserOnboarded(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  try {
    const delegate = (tx as unknown as { user: { update: (args: { where: { id: string }; data: { isOnboarded: boolean } }) => Promise<unknown> } }).user;
    await delegate.update({ where: { id: userId }, data: { isOnboarded: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isPrismaValidationError(error, "isOnboarded") && !/isOnboarded/i.test(message)) throw error;
  }
}

export async function completeOnboarding(userId: string) {
  await ensureUkMobileProviderMappingsSeeded();
  const profile = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!profile) throw new Error("Onboarding profile not found. Save onboarding draft first.");

  const budgetPlan = await ensurePersonalPlan(userId);
  const planningYears = clampIntRange(toNullableNumber(profile.planningYears), 1, 30) ?? 10;
  const payDay = clampPayDay(toNullableNumber(profile.payDay));
  const payAnchorDate = cleanPayAnchorDate(profile.payAnchorDate);
  const payFrequency = normalizePayFrequency(profile.payFrequency);
  const now = new Date();
  const effectiveSetupAt = latestDate(budgetPlan.createdAt, now) ?? now;
  const firstSeedablePayPeriod = resolveFirstSelectablePayPeriodWindow({ payDate: payDay ?? 1, payAnchorDate, payFrequency, planStartAt: effectiveSetupAt });
  const seedStartMonth = firstSeedablePayPeriod.start.getUTCMonth() + 1;
  const seedStartYear = firstSeedablePayPeriod.start.getUTCFullYear();
  const seededIncomePeriods = buildForwardSeedMonths(new Date(firstSeedablePayPeriod.start.getUTCFullYear(), firstSeedablePayPeriod.start.getUTCMonth(), 1), planningYears);
  const seededExpensePeriods = buildForwardSeedPeriodsFromMonth({ startMonth: seedStartMonth, startYear: seedStartYear, planningYears });
  const expenseSeeds = await resolveCategorizedExpenseSeeds({ budgetPlanId: budgetPlan.id, profile });
  const [incomesToCreate, expensesToCreate] = await Promise.all([
    buildIncomeSeedRows({ budgetPlanId: budgetPlan.id, seededIncomePeriods, salary: Number(profile.monthlySalary ?? 0), payDay: payDay ?? 1, payFrequency, payAnchorDate }),
    buildExpenseSeedRows({ budgetPlanId: budgetPlan.id, seededExpensePeriods, expenseSeeds, payDay, payFrequency, payAnchorDate }),
  ]);

  await prisma.$transaction(async (tx) => {
    if (incomesToCreate.length > 0) await tx.income.createMany({ data: incomesToCreate });
    await tx.budgetPlan.update({
      where: { id: budgetPlan.id },
      data: {
        payDate: payDay ?? undefined,
        budgetHorizonYears: planningYears,
        monthlyAllowance: profile.hasAllowance ? Number(profile.allowanceAmount ?? 0) : 0,
      },
    });
    if (expensesToCreate.length > 0) await tx.expense.createMany({ data: expensesToCreate });

    const debtAmount = Number(profile.debtAmount ?? 0);
    if (profile.hasDebtsToManage && debtAmount > 0) {
      const hasDebt = await tx.debt.findFirst({ where: { budgetPlanId: budgetPlan.id }, select: { id: true } });
      if (!hasDebt) {
        await tx.debt.create({ data: { budgetPlanId: budgetPlan.id, name: profile.debtNotes || "Debt to manage", type: "loan", initialBalance: debtAmount, currentBalance: debtAmount, amount: 0, paid: false, paidAmount: 0 } });
      }
    }

    const selectedGoals: OnboardingGoalInput[] = Array.isArray(profile.mainGoals) && profile.mainGoals.length ? profile.mainGoals : profile.mainGoal ? [profile.mainGoal] : [];
    const normalizedGoals = normalizeSelectedGoals(selectedGoals);
    await syncGeneratedGoals({
      tx,
      budgetPlanId: budgetPlan.id,
      selectedGoals,
      savingsGoalAmount: Number(profile.savingsGoalAmount ?? 0),
      targetYear: getBudgetHorizonTargetYear({ planningYears, referenceDate: effectiveSetupAt, fallbackYear: now.getFullYear() }),
    });
    await onboardingDelegate(tx).update({ where: { userId }, data: { status: "completed", completedAt: new Date(), mainGoal: normalizedGoals[0] ?? null, mainGoals: normalizedGoals, generatedPlanId: budgetPlan.id } });
    await markUserOnboarded(tx, userId);
  }, { maxWait: 10_000, timeout: 30_000 });

  return { budgetPlanId: budgetPlan.id };
}