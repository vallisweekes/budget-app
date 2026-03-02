require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { encode } = require('next-auth/jwt');

(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error('No user found');

    const plan = await prisma.budgetPlan.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!plan) throw new Error('No budget plan found for user');

    if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET missing');

    const token = await encode({
      token: { sub: user.id, userId: user.id },
      secret: process.env.NEXTAUTH_SECRET,
    });

    const base = process.env.BASE_URL || 'http://localhost:5537';
    const endpoints = [
      '/api/bff/expenses?budgetPlanId=' + plan.id + '&month=3&year=2026&scope=pay_period',
      '/api/bff/expenses/summary?budgetPlanId=' + plan.id + '&month=3&year=2026&scope=pay_period',
      '/api/bff/dashboard?budgetPlanId=' + plan.id,
      '/api/bff/settings?budgetPlanId=' + plan.id,
      '/api/bff/debt-summary?budgetPlanId=' + plan.id + '&sync=1',
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(base + endpoint, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const text = await response.text();
      console.log('STATUS', response.status, endpoint);
      console.log('BODY', text.slice(0, 180).replace(/\n/g, ' '));
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error('SMOKE_ERR', error && error.stack ? error.stack : error);
  process.exit(1);
});
