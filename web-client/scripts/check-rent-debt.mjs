import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const budgetPlanId = 'cmlkrdtve0001pzwzvuuxgfg0';

try {
  const rentExpense = await prisma.expense.findFirst({
    where: {
      budgetPlanId,
      name: { contains: 'RENT' },
      month: 1,
      year: 2026,
    },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
      month: true,
      year: true,
    },
  });

  console.log('RENT Expense (January 2026):');
  console.log(rentExpense);

  const rentDebt = await prisma.debt.findFirst({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseName: { contains: 'RENT' },
    },
    select: {
      id: true,
      sourceExpenseName: true,
      amount: true,
      currentBalance: true,
      paidAmount: true,
      sourceExpenseId: true,
    },
  });

  console.log('\nRENT Debt:');
  console.log(rentDebt);

  if (rentDebt && rentExpense) {
    console.log('\n=== Analysis ===');
    console.log(`Expense paidAmount: £${rentExpense.paidAmount}`);
    console.log(`Debt paidAmount: £${rentDebt.paidAmount}`);
    console.log(`Debt currentBalance: £${rentDebt.currentBalance}`);
    console.log(`Debt initial amount: £${rentDebt.amount}`);
    const progress = ((Number(rentDebt.paidAmount) / Number(rentDebt.amount)) * 100).toFixed(1);
    console.log(`Progress: ${progress}%`);
  }
} finally {
  await prisma.$disconnect();
}
