import { expandOnboardingExpenseSeed, resolveCategorizedExpenseSeeds } from "@/lib/onboarding/seedData";
import { prisma } from "@/lib/prisma";

type ParsedArgs = Record<string, string>;

type CandidateExpense = {
  id: string;
  name: string;
  amount: unknown;
  month: number;
  year: number;
  dueDate: Date | null;
  periodKey: string | null;
  categoryId: string | null;
  paymentSource: "income" | "savings" | "credit_card" | "emergency" | "extra_untracked" | null;
  cardDebtId: string | null;
  isAllocation: boolean;
  isDirectDebit: boolean;
  isExtraLoggedExpense: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ExistingExpense = {
  id: string;
  name: string;
  amount: unknown;
  month: number;
  year: number;
  categoryId: string | null;
};

type RepairPlan = {
  candidate: CandidateExpense;
  rowsToCreate: Array<{
    name: string;
    amount: number;
    categoryId: string | null;
  }>;
  skipReasons: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }

  return args;
}

function toMoney(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
    if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
    if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
  }

  return Number(value);
}

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function printPlanSummary(label: string, plans: RepairPlan[]) {
  console.log(`${label}: ${plans.length}`);
  for (const plan of plans.slice(0, 20)) {
    const replacements = plan.rowsToCreate.map((item) => `${item.name}:${item.amount.toFixed(2)}`).join(", ");
    const suffix = plan.skipReasons.length ? ` | skip=${plan.skipReasons.join(", ")}` : "";
    const outcome = replacements.length ? replacements : "delete-only";
    console.log(`- ${plan.candidate.id} | ${plan.candidate.year}-${String(plan.candidate.month).padStart(2, "0")} | ${plan.candidate.name} -> ${outcome}${suffix}`);
  }
  if (plans.length > 20) {
    console.log(`...and ${plans.length - 20} more`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email ?? "").trim();
  const apply = args.apply === "true";

  if (!email) {
    throw new Error("Missing required --email argument.");
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      budgetPlans: {
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      onboardingProfile: {
        select: {
          expenseOneName: true,
          expenseOneAmount: true,
          expenseTwoName: true,
          expenseTwoAmount: true,
          expenseThreeName: true,
          expenseThreeAmount: true,
          expenseFourName: true,
          expenseFourAmount: true,
          generatedPlanId: true,
          completedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }

  const generatedPlanId = typeof user.onboardingProfile?.generatedPlanId === "string" && user.onboardingProfile.generatedPlanId.trim().length
    ? user.onboardingProfile.generatedPlanId.trim()
    : null;
  const targetPlan = generatedPlanId
    ? user.budgetPlans.find((plan) => plan.id === generatedPlanId) ?? user.budgetPlans[0]
    : user.budgetPlans[0];

  if (!targetPlan) {
    throw new Error(`No budget plan found for ${email}`);
  }

  if (!user.onboardingProfile) {
    throw new Error(`No onboarding profile found for ${email}`);
  }

  const repairAnchor = latestDate(user.onboardingProfile?.updatedAt ?? null, user.onboardingProfile?.completedAt ?? null, targetPlan.createdAt) ?? targetPlan.createdAt;
  const repairWindowEnd = new Date(repairAnchor.getTime() + 5 * 60 * 1000);
  const expectedSeeds = await resolveCategorizedExpenseSeeds({ budgetPlanId: targetPlan.id, profile: user.onboardingProfile });

  const candidates = await prisma.expense.findMany({
    where: {
      budgetPlanId: targetPlan.id,
      createdAt: { gte: targetPlan.createdAt, lte: repairWindowEnd },
      isAllocation: false,
      isExtraLoggedExpense: false,
      isMovedToDebt: false,
      paid: false,
      paidAmount: 0,
      payments: { none: {} },
      OR: [
        { name: { contains: ",", mode: "insensitive" } },
        { name: { contains: " and ", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      amount: true,
      month: true,
      year: true,
      dueDate: true,
      periodKey: true,
      categoryId: true,
      paymentSource: true,
      cardDebtId: true,
      isAllocation: true,
      isDirectDebit: true,
      isExtraLoggedExpense: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
  });

  const linkedDebtExpenseIds = new Set((await prisma.debt.findMany({
    where: { budgetPlanId: targetPlan.id, sourceExpenseId: { in: candidates.map((expense) => expense.id) } },
    select: { sourceExpenseId: true },
  })).map((row) => row.sourceExpenseId).filter((value): value is string => Boolean(value)));

  const untouchedCandidates = candidates.filter((expense) => !linkedDebtExpenseIds.has(expense.id));
  const touchedPeriods = Array.from(new Set(untouchedCandidates.map((expense) => `${expense.year}-${expense.month}`))).map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year, month };
  });

  const existingRows: ExistingExpense[] = touchedPeriods.length > 0
    ? await prisma.expense.findMany({
        where: {
          budgetPlanId: targetPlan.id,
          OR: touchedPeriods.map((period) => ({ year: period.year, month: period.month })),
        },
        select: {
          id: true,
          name: true,
          amount: true,
          month: true,
          year: true,
          categoryId: true,
        },
      })
    : [];

  const safeRepairs: RepairPlan[] = [];
  const skippedRepairs: RepairPlan[] = [];

  for (const candidate of untouchedCandidates) {
    const categoryExpectedSeeds = expectedSeeds.filter((seed) => seed.categoryId === candidate.categoryId);
    const fallbackSeeds = expandOnboardingExpenseSeed({
      name: candidate.name,
      amount: toMoney(candidate.amount),
      fallbackName: candidate.name,
    }).map((seed) => ({ ...seed, categoryId: candidate.categoryId }));
    const expectedForCandidate = categoryExpectedSeeds.length > 0 ? categoryExpectedSeeds : fallbackSeeds;

    if (expectedForCandidate.length === 0) {
      skippedRepairs.push({ candidate, rowsToCreate: [], skipReasons: ["no-expected-seeds"] });
      continue;
    }

    const periodRows = existingRows.filter((row) => row.year === candidate.year && row.month === candidate.month && row.id !== candidate.id);
    const rowsToCreate: RepairPlan["rowsToCreate"] = [];
    const skipReasons: string[] = [];

    for (const expected of expectedForCandidate) {
      const sameNameRows = periodRows.filter((row) => normalizeName(row.name) === normalizeName(expected.name));
      const exactMatch = sameNameRows.find((row) => toMoney(row.amount) === expected.amount);
      if (exactMatch) {
        continue;
      }

      const ambiguousMatch = sameNameRows.find((row) => toMoney(row.amount) !== expected.amount);
      if (ambiguousMatch) {
        skipReasons.push(`${expected.name}:${toMoney(ambiguousMatch.amount).toFixed(2)}`);
        continue;
      }

      rowsToCreate.push({
        name: expected.name,
        amount: expected.amount,
        categoryId: expected.categoryId ?? candidate.categoryId,
      });
    }

    const withPlan: RepairPlan = { candidate, rowsToCreate, skipReasons };
    if (skipReasons.length > 0) {
      skippedRepairs.push(withPlan);
    } else {
      safeRepairs.push(withPlan);
    }
  }

  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Plan: ${targetPlan.name} (${targetPlan.id})`);
  console.log(`Candidate rows: ${candidates.length}`);
  console.log(`Untouched rows: ${untouchedCandidates.length}`);
  printPlanSummary("Safe repairs", safeRepairs);
  printPlanSummary("Skipped repairs", skippedRepairs);

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply true to perform the repair.");
    return;
  }

  if (!safeRepairs.length) {
    console.log("No safe repairs found. Nothing to update.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const rowsToCreate = safeRepairs.flatMap((plan) => plan.rowsToCreate.map((replacement) => ({
      budgetPlanId: targetPlan.id,
      name: replacement.name,
      amount: replacement.amount,
      month: plan.candidate.month,
      year: plan.candidate.year,
      dueDate: plan.candidate.dueDate,
      paid: false,
      paidAmount: 0,
      isAllocation: plan.candidate.isAllocation,
      isDirectDebit: plan.candidate.isDirectDebit,
      isExtraLoggedExpense: plan.candidate.isExtraLoggedExpense,
      isMovedToDebt: false,
      periodKey: plan.candidate.periodKey,
      categoryId: replacement.categoryId ?? plan.candidate.categoryId ?? undefined,
      paymentSource: plan.candidate.paymentSource ?? undefined,
      cardDebtId: plan.candidate.cardDebtId ?? undefined,
      createdAt: plan.candidate.createdAt,
      updatedAt: plan.candidate.updatedAt,
    })));

    if (rowsToCreate.length > 0) {
      await tx.expense.createMany({ data: rowsToCreate });
    }

    await tx.expense.deleteMany({
      where: { id: { in: safeRepairs.map((plan) => plan.candidate.id) } },
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  console.log(`Created ${safeRepairs.reduce((sum, plan) => sum + plan.rowsToCreate.length, 0)} replacement expenses.`);
  console.log(`Deleted ${safeRepairs.length} combined onboarding expenses.`);
}

main()
  .catch((error) => {
    console.error("repair-combined-onboarding-expenses failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });