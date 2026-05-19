import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";
import { ensureUkMobileProviderMappingsSeeded } from "@/lib/expenses/providerMappings";
import { normalizePayFrequency, resolveFirstSelectablePayPeriodWindow } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";

import { normalizeSelectedGoals, syncGeneratedGoals } from "./goals";
import { repairInvalidPreStartSeededRows } from "./repairCleanup";
import { buildForwardSeedMonths, buildForwardSeedPeriodsFromMonth, ensurePersonalPlan, getBudgetHorizonTargetYear } from "./seed";
import { buildExpenseSeedInputs, buildExpenseSeedRows, buildIncomeSeedRows } from "./seedData";
import type { OnboardingGoalInput } from "./types";
import { clampIntRange, clampPayDay, cleanPayAnchorDate, latestDate, onboardingDelegate, toNullableNumber } from "./utils";

export async function runOnboardingRepairPass(userId: string) {
  await ensureUkMobileProviderMappingsSeeded();
  const profile = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!profile || profile.status !== "completed") return;

  const budgetPlan = typeof profile.generatedPlanId === "string" && profile.generatedPlanId.trim()
    ? await prisma.budgetPlan.findUnique({ where: { id: profile.generatedPlanId.trim() }, select: { id: true, createdAt: true } })
    : await ensurePersonalPlan(userId);
  const ensuredBudgetPlan = budgetPlan ?? await ensurePersonalPlan(userId);
  const planningYears = clampIntRange(toNullableNumber(profile.planningYears), 1, 30) ?? 10;
  const payDay = clampPayDay(toNullableNumber(profile.payDay));
  const payAnchorDate = cleanPayAnchorDate(profile.payAnchorDate);
  const payFrequency = normalizePayFrequency(profile.payFrequency);
  const effectiveSetupAt = latestDate(ensuredBudgetPlan.createdAt, profile.completedAt ?? null, profile.updatedAt ?? null);
  const firstSeedableReferenceAt = latestDate(ensuredBudgetPlan.createdAt, profile.completedAt ?? null) ?? ensuredBudgetPlan.createdAt;
  const firstSeedablePayPeriod = resolveFirstSelectablePayPeriodWindow({ payDate: payDay ?? 1, payAnchorDate, payFrequency, planStartAt: firstSeedableReferenceAt });
  const seedStartMonth = firstSeedablePayPeriod.start.getUTCMonth() + 1;
  const seedStartYear = firstSeedablePayPeriod.start.getUTCFullYear();
  const seededIncomePeriods = buildForwardSeedMonths(new Date(firstSeedablePayPeriod.start.getUTCFullYear(), firstSeedablePayPeriod.start.getUTCMonth(), 1), planningYears);
  const seededExpensePeriods = buildForwardSeedPeriodsFromMonth({ startMonth: seedStartMonth, startYear: seedStartYear, planningYears });
  const [preparedIncomesToCreate, preparedExpensesToCreate] = await Promise.all([
    buildIncomeSeedRows({ budgetPlanId: ensuredBudgetPlan.id, seededIncomePeriods, salary: Number(profile.monthlySalary ?? 0), payDay: payDay ?? 1, payFrequency, payAnchorDate }),
    buildExpenseSeedRows({ budgetPlanId: ensuredBudgetPlan.id, seededExpensePeriods, expenseSeeds: buildExpenseSeedInputs(profile), payDay, payFrequency, payAnchorDate }),
  ]);
  const repairAnchor = latestDate(profile.updatedAt ?? null, profile.completedAt ?? null, ensuredBudgetPlan.createdAt) ?? ensuredBudgetPlan.createdAt;
  const repairWindowEnd = new Date(repairAnchor.getTime() + 5 * 60 * 1000);
  const firstSelectablePeriodKey = firstSeedablePayPeriod.start.toISOString().slice(0, 10);

  await prisma.$transaction(async (tx) => {
    const selectedGoals: OnboardingGoalInput[] = Array.isArray(profile.mainGoals) && profile.mainGoals.length ? profile.mainGoals : profile.mainGoal ? [profile.mainGoal] : [];
    const normalizedGoals = normalizeSelectedGoals(selectedGoals);
    if (preparedIncomesToCreate.length > 0) await tx.income.createMany({ data: preparedIncomesToCreate });
    if (payDay) await tx.budgetPlan.update({ where: { id: ensuredBudgetPlan.id }, data: { payDate: payDay, budgetHorizonYears: planningYears } });
    if (preparedExpensesToCreate.length > 0) await tx.expense.createMany({ data: preparedExpensesToCreate });
    await repairInvalidPreStartSeededRows({
      tx,
      budgetPlanId: ensuredBudgetPlan.id,
      repairWindowStart: ensuredBudgetPlan.createdAt,
      repairWindowEnd,
      firstSelectableStart: firstSeedablePayPeriod.start,
      firstSelectablePeriodKey,
      seedStartMonth,
      seedStartYear,
    });

    const debtAmount = Number(profile.debtAmount ?? 0);
    if (profile.hasDebtsToManage && debtAmount > 0) {
      await tx.debt.updateMany({
        where: {
          budgetPlanId: ensuredBudgetPlan.id,
          type: "loan",
          sourceType: null,
          creditLimit: null,
          dueDay: null,
          dueDate: null,
          monthlyMinimum: null,
          interestRate: null,
          installmentMonths: null,
          initialBalance: debtAmount,
          currentBalance: debtAmount,
          amount: debtAmount,
          paid: false,
          paidAmount: 0,
          historicalPaidAmount: 0,
          createdAt: { gte: ensuredBudgetPlan.createdAt, lte: repairWindowEnd },
        },
        data: { amount: 0 },
      });
      const hasDebt = await tx.debt.findFirst({ where: { budgetPlanId: ensuredBudgetPlan.id }, select: { id: true } });
      if (!hasDebt) {
        await tx.debt.create({ data: { budgetPlanId: ensuredBudgetPlan.id, name: profile.debtNotes || "Debt to manage", type: "loan", initialBalance: debtAmount, currentBalance: debtAmount, amount: 0, paid: false, paidAmount: 0 } });
      }
    }

    await syncGeneratedGoals({
      tx,
      budgetPlanId: ensuredBudgetPlan.id,
      selectedGoals,
      savingsGoalAmount: Number(profile.savingsGoalAmount ?? 0),
      targetYear: getBudgetHorizonTargetYear({ planningYears, referenceDate: effectiveSetupAt, fallbackYear: new Date().getUTCFullYear() }),
    });
    await onboardingDelegate(tx).update({ where: { userId }, data: { mainGoal: normalizedGoals[0] ?? null, mainGoals: normalizedGoals } });
  }, { maxWait: 10_000, timeout: 30_000 });

  await invalidateDashboardCache(ensuredBudgetPlan.id);
}