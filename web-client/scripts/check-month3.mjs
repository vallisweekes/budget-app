import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const plan = await db.budgetPlan.findFirst({
  where: { user: { email: 'vallis.weekes@gmail.com' }, name: 'Personal' },
  select: { id: true }
});

const rows = await db.expense.findMany({
  where: { budgetPlanId: plan.id, month: 3, year: 2026, dueDate: null },
  orderBy: { name: 'asc' },
  select: { id: true, name: true, amount: true, dueDate: true, paid: true }
});

console.log(`Total month=3 unscheduled (no dueDate) rows: ${rows.length}`);
for (const r of rows) {
  console.log(`  ${r.name} £${r.amount} | paid: ${r.paid}`);
}

const allScheduled = await db.expense.findMany({
  where: { budgetPlanId: plan.id, dueDate: { gte: new Date('2026-02-27'), lte: new Date('2026-03-26') } },
  orderBy: { name: 'asc' },
  select: { id: true, name: true, amount: true, dueDate: true, paid: true }
});

console.log(`\nScheduled bills in Feb27-Mar26: ${allScheduled.length}`);
for (const r of allScheduled) {
  console.log(`  ${r.name} £${r.amount} | due: ${r.dueDate?.toISOString().slice(0,10)} | paid: ${r.paid}`);
}

await db.$disconnect();
