import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isAllocationLikeCategory(categoryName: string | null | undefined): boolean {
  const normalized = norm(categoryName);
  if (!normalized) return false;

  // Food & Dining variations
  if (normalized === "food and dining") return true;
  if (normalized === "food & dining") return true;
  if (normalized === "food") return true;
  if (normalized === "dining") return true;
  if (normalized === "groceries") return true;
  if (normalized.includes("food") && normalized.includes("dining")) return true;

  // Transport variations
  if (normalized === "transport") return true;
  if (normalized === "travel") return true;
  if (normalized === "transport / travel") return true;
  if (normalized === "transport/travel") return true;
  if (normalized.includes("transport") || normalized.includes("travel")) return true;

  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const budgetPlanId = String(args.get("budgetPlanId") ?? "").trim();
  const apply = Boolean(args.get("apply") ?? false);

  if (!budgetPlanId) {
    console.error("Missing --budgetPlanId");
    process.exit(1);
  }

  console.log(`Budget Plan ID: ${budgetPlanId}`);
  console.log(`Apply: ${apply}\n`);

  // Step 1: Find and remove duplicate expense-debts (keep the first, delete the rest)
  console.log("=== Step 1: De-duplicate expense-debts ===");
  const allExpenseDebts = await prisma.debt.findMany({
    where: {
      budgetPlanId,
      sourceType: "expense",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sourceExpenseId: true,
      sourceCategoryName: true,
      sourceExpenseName: true,
      currentBalance: true,
    },
  });

  const seenExpenseIds = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const debt of allExpenseDebts) {
    if (!debt.sourceExpenseId) continue;
    const existing = seenExpenseIds.get(debt.sourceExpenseId);
    if (existing) {
      duplicateIds.push(debt.id);
      console.log(
        `  Duplicate: ${debt.sourceExpenseName} (${debt.sourceCategoryName}) - debt ID ${debt.id}`
      );
    } else {
      seenExpenseIds.set(debt.sourceExpenseId, debt.id);
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate debt(s).`);

  if (apply && duplicateIds.length > 0) {
    const deleted = await prisma.debt.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`Deleted ${deleted.count} duplicate debt row(s).\n`);
  } else {
    console.log("Dry run only (re-run with --apply to delete duplicates).\n");
  }

  // Step 2: Tag January food/transport expenses as allocations
  console.log("=== Step 2: Backfill isAllocation for January food/transport ===");
  type AllocationExpenseRow = {
    id: string;
    name: string;
    isAllocation: boolean;
    category: { name: string } | null;
  };

  const janExpenses = (await prisma.expense.findMany({
    where: {
      budgetPlanId,
      year: 2026,
      month: 1, // January
    },
    select: {
      id: true,
      name: true,
      isAllocation: true,
      category: { select: { name: true } },
    },
  } as any)) as unknown as AllocationExpenseRow[];

  const allocationCandidates = janExpenses.filter(
    (e) => !e.isAllocation && isAllocationLikeCategory(e.category?.name)
  );

  console.log(`Matched ${allocationCandidates.length} January expense(s) to tag as allocations.`);
  if (allocationCandidates.length > 0) {
    console.table(
      allocationCandidates.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category?.name ?? null,
      }))
    );
  }

  if (apply && allocationCandidates.length > 0) {
    const ids = allocationCandidates.map((e) => e.id);
    const updated = await prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: { isAllocation: true } as any,
    });
    console.log(`Tagged ${updated.count} expense(s) as allocations.`);

    // Clear linked debts
    const linkedDebts = await prisma.debt.findMany({
      where: {
        budgetPlanId,
        sourceType: "expense",
        sourceExpenseId: { in: ids },
      },
      select: { id: true },
    });

    if (linkedDebts.length > 0) {
      const cleared = await prisma.debt.updateMany({
        where: { id: { in: linkedDebts.map((d) => d.id) } },
        data: { currentBalance: 0, paid: true },
      });
      console.log(`Cleared ${cleared.count} linked debt(s).\n`);
    }
  } else {
    console.log("Dry run only (re-run with --apply to backfill allocations).\n");
  }

  console.log("Done!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
