/**
 * Sync expense scalar fields (paid, paidAmount) FROM expensePayment records.
 * 
 * After switching all read surfaces to use expensePayment, the scalar fields
 * are now a cache. This script makes them consistent.
 *
 * Run: npx tsx scripts/sync-expense-paid-flags.ts
 * Dry: npx tsx scripts/sync-expense-paid-flags.ts --dry-run
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function dn(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(String(v));
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // Get all expenses that have any payment record OR have paid/paidAmount set
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { paid: true },
        { paidAmount: { gt: 0 } },
        { payments: { some: {} } },
      ],
    },
    select: { id: true, name: true, amount: true, paid: true, paidAmount: true, month: true, year: true },
  });

  const ids = expenses.map((e) => e.id);
  const payments = await prisma.expensePayment.groupBy({
    by: ["expenseId"],
    where: { expenseId: { in: ids } },
    _sum: { amount: true },
  });
  const txnMap = new Map(payments.map((p) => [p.expenseId, dn(p._sum.amount)]));

  let updated = 0;
  let alreadyOk = 0;

  for (const e of expenses) {
    const amount = dn(e.amount);
    const currentPaidAmount = dn(e.paidAmount);
    const currentPaid = e.paid;
    const txnTotal = txnMap.get(e.id) ?? 0;
    const correctPaidAmount = Math.min(amount, txnTotal);
    const correctPaid = amount > 0 && txnTotal >= amount;

    const needsUpdate =
      Math.abs(currentPaidAmount - correctPaidAmount) > 0.005 ||
      currentPaid !== correctPaid;

    if (!needsUpdate) {
      alreadyOk++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  WOULD UPDATE: ${e.name} (m${e.month}/${e.year}): paid ${currentPaid}→${correctPaid}, paidAmt £${currentPaidAmount.toFixed(2)}→£${correctPaidAmount.toFixed(2)} (txn=£${txnTotal.toFixed(2)})`
      );
    } else {
      await prisma.expense.update({
        where: { id: e.id },
        data: { paid: correctPaid, paidAmount: correctPaidAmount },
      });
      console.log(
        `  UPDATED: ${e.name} (m${e.month}/${e.year}): paid ${currentPaid}→${correctPaid}, paidAmt £${currentPaidAmount.toFixed(2)}→£${correctPaidAmount.toFixed(2)}`
      );
    }
    updated++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total expenses checked: ${expenses.length}`);
  console.log(`Already consistent: ${alreadyOk}`);
  console.log(`${DRY_RUN ? "Would update" : "Updated"}: ${updated}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
