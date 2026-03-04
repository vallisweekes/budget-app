import { PrismaClient } from '../node_modules/@prisma/client/index.js';
const db = new PrismaClient();
const plan = await db.budgetPlan.findFirst({ where: { user: { email: 'vallis.weekes@gmail.com' }, name: 'Personal' }, select: { id: true } });

// Step 1: Move month=3 SALARY from year=2031 to year=2026
const fix = await db.income.updateMany({ 
  where: { budgetPlanId: plan.id, month: 3, year: 2031, name: 'SALARY' }, 
  data: { year: 2026 } 
});
console.log('Fixed month=3 SALARY year:', fix.count, 'rows -> year=2026');

// Step 2: Delete ALL rows for years 2027-2035
const del = await db.income.deleteMany({ 
  where: { budgetPlanId: plan.id, year: { in: [2027,2028,2029,2030,2031,2032,2033,2034,2035] } } 
});
console.log('Deleted duplicate years 2027-2035:', del.count, 'rows');

// Step 3: Show what's left
const remaining = await db.income.findMany({ where: { budgetPlanId: plan.id }, select: { name: true, amount: true, month: true, year: true }, orderBy: [{ year: 'asc' }, { month: 'asc' }] });
console.log('\nAll remaining income:');
for (const i of remaining) console.log('year:', i.year, 'month:', i.month, i.name, '£'+i.amount);
await db.$disconnect();
