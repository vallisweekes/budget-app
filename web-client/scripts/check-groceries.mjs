import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const user = await db.user.findFirst({ where: { email: 'vallis.weekes@gmail.com' }, select: { id: true } });
const plan = await db.budgetPlan.findFirst({ where: { userId: user.id, kind: 'personal' }, select: { id: true } });

// Check all food/groceries related expenses and categories
const cats = await db.category.findMany({ where: { budgetPlanId: plan.id }, select: { id: true, name: true } });
console.log('All categories:', cats.map(c => c.name));

const foodRows = await db.expense.findMany({
  where: {
    budgetPlanId: plan.id,
    isMovedToDebt: false,
    isAllocation: false,
    OR: [
      { name: { contains: 'food', mode: 'insensitive' } },
      { name: { contains: 'lunch', mode: 'insensitive' } },
      { name: { contains: 'grocer', mode: 'insensitive' } },
      { name: { contains: 'FOOD', mode: 'insensitive' } },
    ]
  },
  select: { id: true, name: true, amount: true, dueDate: true, month: true, year: true, categoryId: true },
  orderBy: [{ year: 'asc' }, { month: 'asc' }],
});
const catById = Object.fromEntries(cats.map(c => [c.id, c.name]));
console.log('\nFood/Groceries rows:', foodRows.length);
for (const r of foodRows) {
  console.log(' ', r.year+'-'+r.month, r.name, '| cat:', catById[r.categoryId]??'none', '| £'+r.amount);
}
await db.$disconnect();
