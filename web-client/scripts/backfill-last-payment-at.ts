import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  days: number;
  apply: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let days = 10;
  let apply = false;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg.startsWith("--days=")) {
      const value = Number(arg.slice("--days=".length));
      if (Number.isFinite(value) && value > 0) {
        days = Math.floor(value);
      }
    }
  }

  return { days, apply };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

async function main() {
  const { days, apply } = parseArgs(process.argv.slice(2));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = await prisma.expense.findMany({
    where: {
      paid: true,
      lastPaymentAt: null,
      paidAmount: { gt: 0 },
      updatedAt: { gte: cutoff },
    },
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (candidates.length === 0) {
    console.log(`[backfill-last-payment-at] No matching paid expenses found in last ${days} days.`);
    return;
  }

  const candidateIds = candidates.map((c) => c.id);
  const groupedPayments = await prisma.expensePayment.groupBy({
    by: ["expenseId"],
    where: { expenseId: { in: candidateIds } },
    _max: { paidAt: true },
  });

  const latestPaidAtByExpenseId = new Map<string, Date>();
  for (const row of groupedPayments) {
    if (row._max.paidAt) latestPaidAtByExpenseId.set(row.expenseId, row._max.paidAt);
  }

  const updates = candidates.map((expense) => ({
    id: expense.id,
    lastPaymentAt: latestPaidAtByExpenseId.get(expense.id) ?? expense.updatedAt,
    usedFallbackUpdatedAt: !latestPaidAtByExpenseId.has(expense.id),
  }));

  const fromPayments = updates.filter((u) => !u.usedFallbackUpdatedAt).length;
  const fromUpdatedAt = updates.filter((u) => u.usedFallbackUpdatedAt).length;

  console.log(`[backfill-last-payment-at] Window: last ${days} days`);
  console.log(`[backfill-last-payment-at] Candidates: ${updates.length}`);
  console.log(`[backfill-last-payment-at] From ExpensePayment.paidAt: ${fromPayments}`);
  console.log(`[backfill-last-payment-at] Fallback from Expense.updatedAt: ${fromUpdatedAt}`);

  if (!apply) {
    console.log("[backfill-last-payment-at] Dry run only. Re-run with --apply to persist changes.");
    return;
  }

  const chunks = chunkArray(updates, 200);
  let updatedCount = 0;

  for (const chunk of chunks) {
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.expense.update({
          where: { id: u.id },
          data: { lastPaymentAt: u.lastPaymentAt },
        })
      )
    );
    updatedCount += chunk.length;
  }

  console.log(`[backfill-last-payment-at] Updated ${updatedCount} expense records.`);
}

main()
  .catch((error) => {
    console.error("[backfill-last-payment-at] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
