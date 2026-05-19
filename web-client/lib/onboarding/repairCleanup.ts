import { prisma } from "@/lib/prisma";

type RepairTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function repairInvalidPreStartSeededRows(params: {
  tx: RepairTx;
  budgetPlanId: string;
  repairWindowStart: Date;
  repairWindowEnd: Date;
  firstSelectableStart: Date;
  firstSelectablePeriodKey: string;
  seedStartMonth: number;
  seedStartYear: number;
}) {
  const invalidExpenses = await params.tx.expense.findMany({
    where: {
      budgetPlanId: params.budgetPlanId,
      createdAt: { gte: params.repairWindowStart, lte: params.repairWindowEnd },
      OR: [
        { dueDate: { lt: params.firstSelectableStart } },
        { periodKey: { not: null, lt: params.firstSelectablePeriodKey } },
        { year: { lt: params.seedStartYear } },
        { AND: [{ year: params.seedStartYear }, { month: { lt: params.seedStartMonth } }] },
      ],
    },
    select: { id: true },
  });
  const invalidExpenseIds = invalidExpenses.map((expense) => expense.id);
  if (invalidExpenseIds.length > 0) {
    const invalidExpenseDebtIds = (await params.tx.debt.findMany({
      where: { budgetPlanId: params.budgetPlanId, sourceType: "expense", sourceExpenseId: { in: invalidExpenseIds } },
      select: { id: true },
    })).map((debt) => debt.id);
    if (invalidExpenseDebtIds.length > 0) {
      await params.tx.debtPayment.deleteMany({ where: { debtId: { in: invalidExpenseDebtIds } } });
      await params.tx.debt.deleteMany({ where: { id: { in: invalidExpenseDebtIds } } });
    }
    await params.tx.expensePayment.deleteMany({ where: { expenseId: { in: invalidExpenseIds } } });
    await params.tx.expense.deleteMany({ where: { id: { in: invalidExpenseIds } } });
  }

  await params.tx.income.deleteMany({
    where: {
      budgetPlanId: params.budgetPlanId,
      createdAt: { gte: params.repairWindowStart, lte: params.repairWindowEnd },
      OR: [
        { periodKey: { not: null, lt: params.firstSelectablePeriodKey } },
        { year: { lt: params.seedStartYear } },
        { AND: [{ year: params.seedStartYear }, { month: { lt: params.seedStartMonth } }] },
      ],
    },
  });
}