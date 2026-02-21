import { prisma } from "../lib/prisma";

async function main() {
  const budgetPlanId = process.argv[2];
  const year = Number(process.argv[3]);
  const month = Number(process.argv[4]);
  if (!budgetPlanId || !year || !month) {
    console.error("Usage: ts-node debug-expenses-total.ts <budgetPlanId> <year> <month>");
    process.exit(1);
  }
  const expenses = await prisma.expense.findMany({
    where: {
      budgetPlanId,
      year,
      month,
      isAllocation: false,
    },
    select: { name: true, amount: true },
  });
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  console.log("Expense items:");
  for (const e of expenses) {
    console.log(`- ${e.name}: £${Number(e.amount).toFixed(2)}`);
  }
  console.log("TOTAL:", total.toFixed(2));
}

main().catch(e => { console.error(e); process.exit(1); });
