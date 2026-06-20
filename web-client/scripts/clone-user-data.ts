import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  apply: boolean;
  source: string;
  targetName: string;
  targetEmail?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }

  return {
    apply: Boolean(args.get("apply")),
    source: String(args.get("source") ?? "vallis").trim(),
    targetName: String(args.get("target-name") ?? "Smith").trim(),
    targetEmail: String(args.get("target-email") ?? "").trim() || undefined,
  };
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isRetryablePrismaError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return code === "P1017" || code === "P1001" || code === "P2028";
}

async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt === maxAttempts) {
        throw error;
      }
      const waitMs = 300 * attempt;
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const sourceUser = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { equals: options.source, mode: "insensitive" } },
        { email: { equals: options.source, mode: "insensitive" } },
      ],
    },
    include: {
      onboardingProfile: true,
      budgetPlans: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sourceUser) {
    throw new Error(`Source user '${options.source}' not found`);
  }

  const existingTarget = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { equals: options.targetName, mode: "insensitive" } },
        ...(options.targetEmail ? [{ email: { equals: options.targetEmail, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true, email: true },
  });

  if (existingTarget) {
    throw new Error(
      `Target already exists (name='${existingTarget.name ?? ""}', email='${existingTarget.email ?? ""}')`,
    );
  }

  const sourcePlans = sourceUser.budgetPlans;
  const sourcePlanIds = sourcePlans.map((p) => p.id);

  const [
    categories,
    incomes,
    goals,
    savingsPots,
    monthlyAllocations,
    allocationDefinitions,
    debts,
    expenses,
    debtPayments,
    expensePayments,
    sacrificeGoalLinks,
    sacrificeTransferConfirmations,
    monthlyAllocationItems,
  ] = await Promise.all([
    prisma.category.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.income.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.goal.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.savingsPot.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.monthlyAllocation.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.allocationDefinition.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.debt.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.expense.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.debtPayment.findMany({ where: { debt: { budgetPlanId: { in: sourcePlanIds } } } }),
    prisma.expensePayment.findMany({ where: { expense: { budgetPlanId: { in: sourcePlanIds } } } }),
    prisma.sacrificeGoalLink.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.sacrificeTransferConfirmation.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
    prisma.monthlyAllocationItem.findMany({ where: { budgetPlanId: { in: sourcePlanIds } } }),
  ]);

  console.log("Clone summary");
  console.log(`source user: ${sourceUser.name ?? "(no name)"} <${sourceUser.email ?? "no-email"}>`);
  console.log(`plans: ${sourcePlans.length}`);
  console.log(
    `categories=${categories.length}, expenses=${expenses.length}, incomes=${incomes.length}, debts=${debts.length}, goals=${goals.length}`,
  );
  console.log(
    `debtPayments=${debtPayments.length}, expensePayments=${expensePayments.length}, savingsPots=${savingsPots.length}, monthlyAllocations=${monthlyAllocations.length}`,
  );

  if (!options.apply) {
    console.log("DRY RUN: add --apply to create the cloned user");
    return;
  }

  {
    const tx = prisma;

    const createdUser = await withRetry("create user", () => tx.user.create({
      data: {
        name: options.targetName,
        email: options.targetEmail,
        image: sourceUser.image,
        phoneNumber: null,
        isOnboarded: sourceUser.isOnboarded,
        theme: sourceUser.theme,
        notificationDueReminders: sourceUser.notificationDueReminders,
        notificationPaymentAlerts: sourceUser.notificationPaymentAlerts,
        notificationDailyTips: sourceUser.notificationDailyTips,
      },
    }));

    if (sourceUser.onboardingProfile) {
      const profile = sourceUser.onboardingProfile;
      await withRetry("create onboarding profile", () => tx.userOnboardingProfile.create({
        data: {
          userId: createdUser.id,
          status: profile.status,
          completedAt: profile.completedAt,
          mainGoal: profile.mainGoal,
          mainGoals: profile.mainGoals,
          occupation: profile.occupation,
          occupationOther: profile.occupationOther,
          payDay: profile.payDay,
          payAnchorDate: profile.payAnchorDate,
          payFrequency: profile.payFrequency,
          billFrequency: profile.billFrequency,
          monthlySalary: profile.monthlySalary,
          planningYears: profile.planningYears,
          savingsGoalAmount: profile.savingsGoalAmount,
          savingsGoalYear: profile.savingsGoalYear,
          expenseOneName: profile.expenseOneName,
          expenseOneAmount: profile.expenseOneAmount,
          expenseTwoName: profile.expenseTwoName,
          expenseTwoAmount: profile.expenseTwoAmount,
          expenseThreeName: profile.expenseThreeName,
          expenseThreeAmount: profile.expenseThreeAmount,
          expenseFourName: profile.expenseFourName,
          expenseFourAmount: profile.expenseFourAmount,
          hasAllowance: profile.hasAllowance,
          allowanceAmount: profile.allowanceAmount,
          hasDebtsToManage: profile.hasDebtsToManage,
          debtAmount: profile.debtAmount,
          debtNotes: profile.debtNotes,
        },
      }));
    }

    const planIdMap = new Map<string, string>();
    for (const sourcePlan of sourcePlans) {
      const plan = await withRetry("create budget plan", () => tx.budgetPlan.create({
        data: {
          name: sourcePlan.name,
          kind: sourcePlan.kind,
          userId: createdUser.id,
          eventDate: sourcePlan.eventDate,
          includePostEventIncome: sourcePlan.includePostEventIncome,
          categorySeedVersion: sourcePlan.categorySeedVersion,
          payDate: sourcePlan.payDate,
          monthlyAllowance: sourcePlan.monthlyAllowance,
          savingsBalance: sourcePlan.savingsBalance,
          emergencyBalance: sourcePlan.emergencyBalance,
          investmentBalance: sourcePlan.investmentBalance,
          monthlySavingsContribution: sourcePlan.monthlySavingsContribution,
          monthlyEmergencyContribution: sourcePlan.monthlyEmergencyContribution,
          monthlyInvestmentContribution: sourcePlan.monthlyInvestmentContribution,
          budgetStrategy: sourcePlan.budgetStrategy,
          budgetHorizonYears: sourcePlan.budgetHorizonYears,
          incomeDistributeFullYearDefault: sourcePlan.incomeDistributeFullYearDefault,
          incomeDistributeHorizonDefault: sourcePlan.incomeDistributeHorizonDefault,
          homepageGoalIds: sourcePlan.homepageGoalIds,
          country: sourcePlan.country,
          language: sourcePlan.language,
          currency: sourcePlan.currency,
        },
      }));
      planIdMap.set(sourcePlan.id, plan.id);
    }

    const categoryIdMap = new Map<string, string>();
    const createdCategoryIds = new Set<string>();
    for (const sourceCategory of categories) {
      const created = await withRetry("create category", () => tx.category.create({
        data: {
          name: sourceCategory.name,
          icon: sourceCategory.icon,
          color: sourceCategory.color,
          featured: sourceCategory.featured,
          budgetPlanId: planIdMap.get(sourceCategory.budgetPlanId)!,
        },
      }));
      categoryIdMap.set(sourceCategory.id, created.id);
      createdCategoryIds.add(created.id);
    }

    const debtIdMap = new Map<string, string>();
    for (const sourceDebt of debts) {
      const created = await withRetry("create debt", () => tx.debt.create({
        data: {
          name: sourceDebt.name,
          type: sourceDebt.type,
          creditLimit: sourceDebt.creditLimit,
          dueDay: sourceDebt.dueDay,
          dueDate: sourceDebt.dueDate,
          lastAccrualMonth: sourceDebt.lastAccrualMonth,
          initialBalance: sourceDebt.initialBalance,
          currentBalance: sourceDebt.currentBalance,
          amount: sourceDebt.amount,
          paid: sourceDebt.paid,
          paidAmount: sourceDebt.paidAmount,
          historicalPaidAmount: sourceDebt.historicalPaidAmount,
          defaultPaymentSource: sourceDebt.defaultPaymentSource,
          defaultPaymentCardDebtId: null,
          monthlyMinimum: sourceDebt.monthlyMinimum,
          interestRate: sourceDebt.interestRate,
          installmentMonths: sourceDebt.installmentMonths,
          budgetPlanId: planIdMap.get(sourceDebt.budgetPlanId)!,
          sourceType: sourceDebt.sourceType,
          sourceExpenseId: sourceDebt.sourceExpenseId,
          sourceMonthKey: sourceDebt.sourceMonthKey,
          sourceCategoryId: sourceDebt.sourceCategoryId ? categoryIdMap.get(sourceDebt.sourceCategoryId) ?? null : null,
          sourceCategoryName: sourceDebt.sourceCategoryName,
          sourceExpenseName: sourceDebt.sourceExpenseName,
          isDirectDebit: sourceDebt.isDirectDebit,
        },
      }));
      debtIdMap.set(sourceDebt.id, created.id);
    }

    const expenseIdMap = new Map<string, string>();
    for (const sourceExpense of expenses) {
      const mappedCategoryId = sourceExpense.categoryId
        ? categoryIdMap.get(sourceExpense.categoryId) ?? null
        : null;
      const safeCategoryId = mappedCategoryId && createdCategoryIds.has(mappedCategoryId)
        ? mappedCategoryId
        : null;

      const created = await withRetry("create expense", () => tx.expense.create({
        data: {
          name: sourceExpense.name,
          merchantDomain: sourceExpense.merchantDomain,
          logoUrl: sourceExpense.logoUrl,
          logoSource: sourceExpense.logoSource,
          seriesKey: sourceExpense.seriesKey,
          amount: sourceExpense.amount,
          paid: sourceExpense.paid,
          paidAmount: sourceExpense.paidAmount,
          isAllocation: sourceExpense.isAllocation,
          isDirectDebit: sourceExpense.isDirectDebit,
          isExtraLoggedExpense: sourceExpense.isExtraLoggedExpense,
          isMovedToDebt: sourceExpense.isMovedToDebt,
          month: sourceExpense.month,
          year: sourceExpense.year,
          dueDate: sourceExpense.dueDate,
          periodKey: sourceExpense.periodKey,
          budgetPlanId: planIdMap.get(sourceExpense.budgetPlanId)!,
          categoryId: safeCategoryId,
          lastPaymentAt: sourceExpense.lastPaymentAt,
          paymentSource: sourceExpense.paymentSource,
          cardDebtId: sourceExpense.cardDebtId ? debtIdMap.get(sourceExpense.cardDebtId) ?? null : null,
        },
      }));
      expenseIdMap.set(sourceExpense.id, created.id);
    }

    for (const sourceDebt of debts) {
      const nextDebtId = debtIdMap.get(sourceDebt.id)!;
      await withRetry("update debt references", () => tx.debt.update({
        where: { id: nextDebtId },
        data: {
          defaultPaymentCardDebtId: sourceDebt.defaultPaymentCardDebtId
            ? debtIdMap.get(sourceDebt.defaultPaymentCardDebtId) ?? null
            : null,
          sourceExpenseId: sourceDebt.sourceExpenseId ? expenseIdMap.get(sourceDebt.sourceExpenseId) ?? null : null,
        },
      }));
    }

    for (const sourceIncome of incomes) {
      await withRetry("create income", () => tx.income.create({
        data: {
          name: sourceIncome.name,
          amount: sourceIncome.amount,
          month: sourceIncome.month,
          year: sourceIncome.year,
          periodKey: sourceIncome.periodKey,
          budgetPlanId: planIdMap.get(sourceIncome.budgetPlanId)!,
        },
      }));
    }

    const goalIdMap = new Map<string, string>();
    for (const sourceGoal of goals) {
      const created = await withRetry("create goal", () => tx.goal.create({
        data: {
          title: sourceGoal.title,
          type: sourceGoal.type,
          category: sourceGoal.category,
          description: sourceGoal.description,
          targetAmount: sourceGoal.targetAmount,
          currentAmount: sourceGoal.currentAmount,
          targetYear: sourceGoal.targetYear,
          budgetPlanId: planIdMap.get(sourceGoal.budgetPlanId)!,
        },
      }));
      goalIdMap.set(sourceGoal.id, created.id);
    }

    for (const row of savingsPots) {
      await withRetry("create savings pot", () => tx.savingsPot.create({
        data: {
          field: row.field,
          name: row.name,
          amount: row.amount,
          broker: row.broker,
          allocationId: row.allocationId,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
        },
      }));
    }

    for (const row of monthlyAllocations) {
      await withRetry("create monthly allocation", () => tx.monthlyAllocation.create({
        data: {
          year: row.year,
          month: row.month,
          monthlyAllowance: row.monthlyAllowance,
          monthlySavingsContribution: row.monthlySavingsContribution,
          monthlyEmergencyContribution: row.monthlyEmergencyContribution,
          monthlyInvestmentContribution: row.monthlyInvestmentContribution,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
        },
      }));
    }

    const allocationIdMap = new Map<string, string>();
    for (const row of allocationDefinitions) {
      const created = await withRetry("create allocation definition", () => tx.allocationDefinition.create({
        data: {
          name: row.name,
          defaultAmount: row.defaultAmount,
          sortOrder: row.sortOrder,
          isArchived: row.isArchived,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
        },
      }));
      allocationIdMap.set(row.id, created.id);
    }

    for (const row of monthlyAllocationItems) {
      await withRetry("create monthly allocation item", () => tx.monthlyAllocationItem.create({
        data: {
          year: row.year,
          month: row.month,
          amount: row.amount,
          allocationId: allocationIdMap.get(row.allocationId)!,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
        },
      }));
    }

    for (const row of debtPayments) {
      await withRetry("create debt payment", () => tx.debtPayment.create({
        data: {
          debtId: debtIdMap.get(row.debtId)!,
          amount: row.amount,
          paidAt: row.paidAt,
          year: row.year,
          month: row.month,
          periodKey: row.periodKey,
          source: row.source,
          cardDebtId: row.cardDebtId ? debtIdMap.get(row.cardDebtId) ?? null : null,
          notes: row.notes,
        },
      }));
    }

    for (const row of expensePayments) {
      await withRetry("create expense payment", () => tx.expensePayment.create({
        data: {
          expenseId: expenseIdMap.get(row.expenseId)!,
          amount: row.amount,
          source: row.source,
          debtId: row.debtId ? debtIdMap.get(row.debtId) ?? null : null,
          paidAt: row.paidAt,
          periodKey: row.periodKey,
        },
      }));
    }

    for (const row of sacrificeGoalLinks) {
      await withRetry("create sacrifice goal link", () => tx.sacrificeGoalLink.create({
        data: {
          targetKey: row.targetKey,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
          goalId: goalIdMap.get(row.goalId)!,
        },
      }));
    }

    for (const row of sacrificeTransferConfirmations) {
      await withRetry("create sacrifice transfer confirmation", () => tx.sacrificeTransferConfirmation.create({
        data: {
          year: row.year,
          month: row.month,
          targetKey: row.targetKey,
          amount: row.amount,
          confirmedAt: row.confirmedAt,
          budgetPlanId: planIdMap.get(row.budgetPlanId)!,
          goalId: goalIdMap.get(row.goalId)!,
        },
      }));
    }

    console.log(`Created cloned user '${options.targetName}' with id=${createdUser.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });