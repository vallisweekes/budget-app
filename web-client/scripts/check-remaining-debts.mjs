import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const budgetPlanId = 'cmlkrdtve0001pzwzvuuxgfg0';

try {
  const debts = await prisma.debt.findMany({
    where: { budgetPlanId, sourceType: 'expense' },
    select: {
      id: true,
      sourceExpenseName: true,
      sourceCategoryName: true,
      amount: true,
      currentBalance: true,
      sourceMonthKey: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  
  console.log(`Found ${debts.length} expense-backed debt(s):`);
  console.table(debts);
} finally {
  await prisma.$disconnect();
}
