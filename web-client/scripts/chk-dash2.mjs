import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const plan = await db.budgetPlan.findFirst({ where: { user: { email: 'vallis.weekes@gmail.com' }, name: 'Personal' }, select: { id: true, monthlyAllowance: true } });
console.log(`monthlyAllowance: ${plan.monthlyAllowance}`);
const debts = await db.debt.findMany({ where: { budgetPlanId: plan.id, paid: false }, select: { name: true, remainingBalance: true, monthlyPayment: true } });
let mp = 0, bal = 0;
for (const d of debts) { mp += parseFloat(String(d.monthlyPayment??0)); bal += parseFloat(String(d.remainingBalance??0)); console.log(`  "${d.name}" bal:${d.remainingBalance} monthly:${d.monthlyPayment}`); }
console.log(`monthly debt payments: £${mp.toFixed(2)}, total balances: £${bal.toFixed(2)}`);
await db.$disconnect();
