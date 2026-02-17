import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const budgetPlanId = 'cmlkrdtve0001pzwzvuuxgfg0';

try {
  // Update AUDIO GEAR to be paid and allocation
  const audioGear = await prisma.expense.findFirst({
    where: { budgetPlanId, name: { contains: 'AUDIO' } },
    select: { id: true, name: true, amount: true },
  });
  
  if (!audioGear) {
    console.log('AUDIO GEAR expense not found');
    process.exit(0);
  }
  
  console.log(`Found: ${audioGear.name} (£${audioGear.amount})`);
  
  // Mark as paid and allocation
  await prisma.expense.update({
    where: { id: audioGear.id },
    data: {
      paid: true,
      paidAmount: audioGear.amount,
      isAllocation: true,
    },
  });
  console.log('✓ Marked AUDIO GEAR as paid and allocation');
  
  // Clear the debt
  const debts = await prisma.debt.findMany({
    where: {
      budgetPlanId,
      sourceType: 'expense',
      sourceExpenseId: audioGear.id,
    },
    select: { id: true },
  });
  
  if (debts.length > 0) {
    const deleteResult = await prisma.debt.deleteMany({
      where: { id: { in: debts.map(d => d.id) } },
    });
    console.log(`✓ Deleted ${deleteResult.count} AUDIO GEAR debt(s)`);
  } else {
    console.log('No AUDIO GEAR debts found');
  }
} finally {
  await prisma.$disconnect();
}
