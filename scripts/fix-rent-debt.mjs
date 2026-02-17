import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const budgetPlanId = 'cmlkrdtve0001pzwzvuuxgfg0';

try {
  // Fix the RENT debt to match the expense
  const rentExpense = await prisma.expense.findFirst({
    where: {
      budgetPlanId,
      name: { contains: 'RENT' },
      month: 1,
      year: 2026,
    },
    select: {
      id: true,
      amount: true,
      paidAmount: true,
    },
  });

  if (!rentExpense) {
    console.log('RENT expense not found');
    process.exit(0);
  }

  const remaining = Math.max(0, Number(rentExpense.amount) - Number(rentExpense.paidAmount));

  console.log('Fixing RENT debt...');
  console.log(`Expense amount: £${rentExpense.amount}`);
  console.log(`Expense paidAmount: £${rentExpense.paidAmount}`);
  console.log(`Remaining (should be currentBalance): £${remaining}`);

  const updated = await prisma.debt.updateMany({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseId: rentExpense.id,
    },
    data: {
      amount: rentExpense.amount,
      currentBalance: remaining,
      paidAmount: rentExpense.paidAmount,
    },
  });

  console.log(`\n✓ Updated ${updated.count} debt(s)`);

  // Verify
  const rentDebt = await prisma.debt.findFirst({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseId: rentExpense.id,
    },
    select: {
      sourceExpenseName: true,
      amount: true,
      currentBalance: true,
      paidAmount: true,
    },
  });

  console.log('\nUpdated debt:');
  console.log(rentDebt);
} finally {
  await prisma.$disconnect();
}
