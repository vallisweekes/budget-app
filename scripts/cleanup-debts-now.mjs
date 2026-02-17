import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const budgetPlanId = process.argv[2];
const apply = process.argv.includes("--apply");

if (!budgetPlanId) {
  console.error("Usage: node cleanup-debts-now.mjs <budgetPlanId> [--apply]");
  process.exit(1);
}

console.log(`Budget Plan ID: ${budgetPlanId}`);
console.log(`Apply: ${apply}\n`);

try {
  // Step 1: Find and remove duplicate expense-debts (keep the oldest one per expenseId)
  console.log("=== Step 1: De-duplicate expense-debts ===");
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
      console.log(`  Duplicate: ${debt.sourceExpenseName} [monthKey=${debt.sourceMonthKey}]`);
    } else {
      seenExpenseIds.set(debt.sourceExpenseId, debt.id);
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate debt(s).`);

  if (apply && duplicateIds.length > 0) {
    const deleted = await prisma.debt.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`✓ Deleted ${deleted.count} duplicate debt row(s).\n`);
  }

  // Step 2: Clear debts for expenses that are marked as allocations
  console.log("=== Step 2: Clear debts for allocation expenses ===");
  const allocationExpenses = await prisma.expense.findMany({
    where: { budgetPlanId, isAllocation: true },
    select: { id: true, name: true },
  });

  console.log(`Found ${allocationExpenses.length} allocation expense(s).`);
  
  if (allocationExpenses.length > 0) {
    const allocationExpenseIds = allocationExpenses.map(e => e.id);
    const allocationDebts = await prisma.debt.findMany({
      where: {
        budgetPlanId,
        sourceType: "expense",
        sourceExpenseId: { in: allocationExpenseIds },
      },
      select: { id: true, sourceExpenseName: true },
    });

    console.log(`Found ${allocationDebts.length} debt(s) linked to allocations.`);
    
    if (apply && allocationDebts.length > 0) {
      allocationDebts.forEach(d => console.log(`  Will clear: ${d.sourceExpenseName}`));
      const cleared = await prisma.debt.deleteMany({
        where: { id: { in: allocationDebts.map(d => d.id) } },
      });
      console.log(`✓ Deleted ${cleared.count} allocation-linked debt(s).\n`);
    }
  }

  // Step 3: Clear debts for expenses that are fully paid
  console.log("=== Step 3: Clear debts for paid expenses ===");
  const allExpenses = await prisma.expense.findMany({
    where: { budgetPlanId },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
    },
  });

  const paidExpenseIds = allExpenses
    .filter(e => {
      const amt = Number(e.amount);
      const paidAmt = Number(e.paidAmount);
      return e.paid || (amt > 0 && paidAmt >= amt);
    })
    .map(e => e.id);

  console.log(`Found ${paidExpenseIds.length} paid expense(s).`);

  if (paidExpenseIds.length > 0) {
    const paidDebts = await prisma.debt.findMany({
      where: {
        budgetPlanId,
        sourceType: "expense",
        sourceExpenseId: { in: paidExpenseIds },
      },
      select: { id: true, sourceExpenseName: true },
    });

    console.log(`Found ${paidDebts.length} debt(s) linked to paid expenses.`);

    if (apply && paidDebts.length > 0) {
      paidDebts.forEach(d => console.log(`  Will clear: ${d.sourceExpenseName}`));
      const cleared = await prisma.debt.deleteMany({
        where: { id: { in: paidDebts.map(d => d.id) } },
      });
      console.log(`✓ Deleted ${cleared.count} paid-expense debt(s).\n`);
    }
  }

  // Step 4: Clear any paid or zero-balance debts
  console.log("=== Step 4: Clear paid/zero-balance debts ===");
  const staleDebts = await prisma.debt.findMany({
    where: {
      budgetPlanId,
      sourceType: "expense",
      OR: [
        { currentBalance: { lte: 0 } },
        { paid: true },
      ],
    },
    select: { id: true, sourceExpenseName: true },
  });

  console.log(`Found ${staleDebts.length} stale debt(s).`);

  if (apply && staleDebts.length > 0) {
    const cleared = await prisma.debt.deleteMany({
      where: { id: { in: staleDebts.map(d => d.id) } },
    });
    console.log(`✓ Deleted ${cleared.count} stale debt(s).\n`);
  }

  if (!apply) {
    console.log("\n⚠️  DRY RUN ONLY - Re-run with --apply to make changes");
  } else {
    console.log("\n✓ Done! All debts cleaned up.");
  }
} finally {
  await prisma.$disconnect();
}
