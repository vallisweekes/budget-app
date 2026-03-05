/**
 * One-time reconciliation: create missing `expensePayment` records for expenses
 * that have `paidAmount > 0` but no (or insufficient) payment transaction records.
 *
 * This bridges the gap between the scalar `expense.paid / paidAmount` fields
 * (which are sometimes set by seeds, imports, or the old `toggleExpensePaid`)
 * and the `expensePayment` transaction table (the new single source of truth).
 *
 * Run with:  npx tsx scripts/reconcile-expense-payments.ts
 * Dry-run:   npx tsx scripts/reconcile-expense-payments.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  const asObj = value as { toString?: () => string };
  return Number(asObj?.toString?.() ?? value);
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // 1. Find all expenses with paidAmount > 0 across all budget plans
  const expenses = await prisma.expense.findMany({
    where: { paidAmount: { gt: 0 } },
    select: {
      id: true,
      name: true,
      amount: true,
      paidAmount: true,
      paid: true,
      paymentSource: true,
      month: true,
      year: true,
      dueDate: true,
      budgetPlanId: true,
    },
  });

  console.log(`Found ${expenses.length} expenses with paidAmount > 0`);

  // 2. Get ALL existing payment records for those expenses
  const expenseIds = expenses.map((e) => e.id);
  const existingPayments = await prisma.expensePayment.groupBy({
    by: ["expenseId"],
    where: { expenseId: { in: expenseIds } },
    _sum: { amount: true },
  });
  const paymentSumByExpenseId = new Map(
    existingPayments.map((p) => [p.expenseId, decimalToNumber(p._sum.amount)])
  );

  // 3. For each expense, check if payment records cover the paidAmount
  let reconciled = 0;
  let skipped = 0;
  let alreadyOk = 0;

  for (const exp of expenses) {
    const paidAmount = decimalToNumber(exp.paidAmount);
    const existingTotal = paymentSumByExpenseId.get(exp.id) ?? 0;
    const gap = paidAmount - existingTotal;

    if (gap <= 0.005) {
      // Payment records already cover the paidAmount (or exceed it)
      alreadyOk++;
      continue;
    }

    // Determine payment date: use dueDate if available, otherwise first of the expense month
    const paidAt = exp.dueDate
      ? new Date(exp.dueDate)
      : new Date(Date.UTC(exp.year, exp.month - 1, 1));

    const source = exp.paymentSource ?? "income";

    if (DRY_RUN) {
      console.log(
        `  WOULD CREATE: ${exp.name} (m${exp.month}/${exp.year}): gap=£${gap.toFixed(2)}, source=${source}, paidAt=${paidAt.toISOString().slice(0, 10)}`
      );
      reconciled++;
    } else {
      try {
        await prisma.expensePayment.create({
          data: {
            expenseId: exp.id,
            amount: gap,
            source: source as any,
            paidAt,
          },
        });
        console.log(
          `  CREATED: ${exp.name} (m${exp.month}/${exp.year}): £${gap.toFixed(2)}, source=${source}`
        );
        reconciled++;
      } catch (err) {
        console.error(`  FAILED: ${exp.name} (${exp.id}):`, err);
        skipped++;
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total expenses with paidAmount > 0: ${expenses.length}`);
  console.log(`Already have matching payment records: ${alreadyOk}`);
  console.log(`${DRY_RUN ? "Would reconcile" : "Reconciled"}: ${reconciled}`);
  console.log(`Skipped/failed: ${skipped}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
