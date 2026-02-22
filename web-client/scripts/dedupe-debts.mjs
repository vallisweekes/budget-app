import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const budgetPlanId = process.argv[2];
const apply = process.argv.includes("--apply");

if (!budgetPlanId) {
  console.error("Usage: node dedupe-debts.mjs <budgetPlanId> [--apply]");
  process.exit(1);
}

console.log(`Budget Plan ID: ${budgetPlanId}`);
console.log(`Apply: ${apply}\n`);

try {
  // Find and remove duplicate expense-debts
  console.log("=== De-duplicate expense-debts ===");
  const allExpenseDebts = await prisma.debt.findMany({
    where: { budgetPlanId, sourceType: "expense" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sourceExpenseId: true,
      sourceCategoryName: true,
      sourceExpenseName: true,
      sourceMonthKey: true,
      currentBalance: true,
    },
  });

  const seenExpenseIds = new Map();
  const duplicateIds = [];

  for (const debt of allExpenseDebts) {
    if (!debt.sourceExpenseId) continue;
    const existing = seenExpenseIds.get(debt.sourceExpenseId);
    if (existing) {
      duplicateIds.push(debt.id);
      console.log(`  Duplicate: ${debt.sourceExpenseName} (${debt.sourceCategoryName}) [monthKey=${debt.sourceMonthKey}] - debt ID ${debt.id}`);
    } else {
      seenExpenseIds.set(debt.sourceExpenseId, debt.id);
      console.log(`  Keep: ${debt.sourceExpenseName} (${debt.sourceCategoryName}) [monthKey=${debt.sourceMonthKey}] - debt ID ${debt.id}`);
    }
  }

  console.log(`\nFound ${duplicateIds.length} duplicate debt(s).`);

  if (apply && duplicateIds.length > 0) {
    const deleted = await prisma.debt.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`Deleted ${deleted.count} duplicate debt row(s).`);
  } else {
    console.log("Dry run only (re-run with --apply to delete duplicates).");
  }

  console.log("\nDone!");
} finally {
  await prisma.$disconnect();
}
