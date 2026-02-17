import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const budgetPlanId = 'cmlkrdtve0001pzwzvuuxgfg0';

try {
  // Delete AUDIO GEAR debt (old ID with FEBURARY monthKey)
  const audioGearResult = await prisma.debt.deleteMany({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseName: { contains: 'AUDIO' },
    },
  });
  console.log(`✓ Deleted ${audioGearResult.count} AUDIO GEAR debt(s)`);

  // Delete WORK TRAVEL debt (Transport category)
  const workTravelResult = await prisma.debt.deleteMany({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseName: { contains: 'WORK TRAVEL' },
    },
  });
  console.log(`✓ Deleted ${workTravelResult.count} WORK TRAVEL debt(s)`);

  // Check final count
  const remaining = await prisma.debt.count({
    where: { budgetPlanId, sourceType: 'expense' },
  });
  console.log(`\nRemaining expense-backed debts: ${remaining}`);
} finally {
  await prisma.$disconnect();
}
