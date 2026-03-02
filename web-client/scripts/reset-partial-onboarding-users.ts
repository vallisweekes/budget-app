import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  apply: boolean;
  targetUsername: string;
  suspiciousAmount: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }

  return {
    apply: Boolean(args.get("apply")),
    targetUsername: String(args.get("target") ?? "_tblair").trim(),
    suspiciousAmount: String(args.get("amount") ?? "525").trim(),
  };
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

async function getPreferredBudgetPlanId(userId: string): Promise<string | null> {
  const personal = await prisma.budgetPlan.findFirst({
    where: { userId, kind: "personal" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (personal) return personal.id;

  const mostRecent = await prisma.budgetPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return mostRecent?.id ?? null;
}

async function getSetupCounts(userId: string, preferredPlanId: string) {
  const [incomeAny, nonAllocationExpenseAny, categorizedExpenseAny, debtAny, goalAny] = await Promise.all([
    prisma.income.count({ where: { budgetPlan: { userId } } }),
    prisma.expense.count({ where: { budgetPlanId: preferredPlanId, isAllocation: false } }),
    prisma.expense.count({
      where: {
        budgetPlanId: preferredPlanId,
        isAllocation: false,
        categoryId: { not: null },
      },
    }),
    prisma.debt.count({ where: { budgetPlan: { userId } } }),
    prisma.goal.count({ where: { budgetPlan: { userId } } }),
  ]);

  return {
    incomeAny,
    nonAllocationExpenseAny,
    categorizedExpenseAny,
    debtAny,
    goalAny,
  };
}

function isFullyConfigured(counts: {
  incomeAny: number;
  nonAllocationExpenseAny: number;
  categorizedExpenseAny: number;
  debtAny: number;
  goalAny: number;
}): boolean {
  if (counts.incomeAny <= 0) return false;
  if (counts.nonAllocationExpenseAny <= 0) return false;

  // Keep users who have richer planning data, even when some expenses are uncategorized.
  return counts.categorizedExpenseAny > 0 || counts.debtAny > 0 || counts.goalAny > 0;
}

async function resetPartialUser(userId: string, apply: boolean) {
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isOnboarded: false },
    });

    await tx.userOnboardingProfile.upsert({
      where: { userId },
      create: {
        userId,
        status: "started",
        completedAt: null,
        generatedPlanId: null,
      },
      update: {
        status: "started",
        completedAt: null,
        generatedPlanId: null,
      },
    });
  });
}

async function cleanupSuspiciousTblairExpense(params: {
  userId: string;
  amount: string;
  apply: boolean;
}) {
  const plans = await prisma.budgetPlan.findMany({
    where: { userId: params.userId },
    select: { id: true },
  });

  if (!plans.length) return { matched: 0, deleted: 0 };

  const where = {
    budgetPlanId: { in: plans.map((plan) => plan.id) },
    isAllocation: false,
    categoryId: null,
    amount: params.amount,
  } as const;

  const matched = await prisma.expense.count({ where });
  if (!params.apply || matched === 0) {
    return { matched, deleted: 0 };
  }

  const deleted = await prisma.expense.deleteMany({ where });
  return { matched, deleted: deleted.count };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isOnboarded: true,
      onboardingProfile: {
        select: {
          status: true,
        },
      },
      budgetPlans: {
        select: { id: true },
      },
    },
  });

  console.log(`Scanned users: ${users.length}`);
  console.log(`Mode: ${options.apply ? "APPLY" : "DRY-RUN"}`);

  let fullUsers = 0;
  let partialUsers = 0;
  let resetUsers = 0;

  for (const user of users) {
    if (!user.budgetPlans.length) {
      continue;
    }

    const preferredPlanId = await getPreferredBudgetPlanId(user.id);
    if (!preferredPlanId) continue;

    const counts = await getSetupCounts(user.id, preferredPlanId);
    const full = isFullyConfigured(counts);

    if (full) {
      fullUsers += 1;
      continue;
    }

    partialUsers += 1;

    console.log(
      [
        `Partial user: ${user.name ?? "(no name)"}`,
        user.email ? `<${user.email}>` : "",
        `income=${counts.incomeAny}`,
        `expenses=${counts.nonAllocationExpenseAny}`,
        `categorizedExpenses=${counts.categorizedExpenseAny}`,
        `debts=${counts.debtAny}`,
        `goals=${counts.goalAny}`,
        `onboarded=${user.isOnboarded}`,
        `profile=${user.onboardingProfile?.status ?? "none"}`,
      ]
        .filter(Boolean)
        .join(" | ")
    );

    await resetPartialUser(user.id, options.apply);
    if (options.apply) {
      resetUsers += 1;
    }
  }

  const tblair = users.find((user) => {
    const name = normalize(user.name);
    const email = normalize(user.email);
    const target = normalize(options.targetUsername);
    if (!target) return false;
    if (name === target) return true;
    if (!email) return false;
    const emailLocal = email.split("@")[0] ?? "";
    return emailLocal === target;
  });

  let tblairMatched = 0;
  let tblairDeleted = 0;

  if (tblair) {
    const cleanup = await cleanupSuspiciousTblairExpense({
      userId: tblair.id,
      amount: options.suspiciousAmount,
      apply: options.apply,
    });
    tblairMatched = cleanup.matched;
    tblairDeleted = cleanup.deleted;

    console.log(
      `_tblair cleanup: matched uncategorized ${options.suspiciousAmount} expense(s)=${tblairMatched}, deleted=${tblairDeleted}`
    );
  } else {
    console.log(`Target user ${options.targetUsername} was not found.`);
  }

  console.log(`Fully configured users kept as-is: ${fullUsers}`);
  console.log(`Partial users found: ${partialUsers}`);
  console.log(`Partial users reset to onboarding started: ${resetUsers}`);

  if (!options.apply) {
    console.log("Dry run complete. Re-run with --apply to persist changes.");
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
