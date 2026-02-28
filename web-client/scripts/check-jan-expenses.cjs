"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 160);

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: "vallis.weekes@gmail.com", mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) { console.log("no user"); return; }

  const plans = await prisma.budgetPlan.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  const planIds = plans.map((p) => p.id);
  console.log("Plans:", plans.map((p) => p.name).join(", "));

  const jan = await prisma.expense.findMany({
    where: { budgetPlanId: { in: planIds }, year: 2026, month: 1, isAllocation: false },
    select: { id: true, name: true, merchantDomain: true, seriesKey: true, categoryId: true, amount: true, paid: true, paidAmount: true, dueDate: true },
    orderBy: [{ categoryId: "asc" }, { createdAt: "asc" }],
  });

  const feb = await prisma.expense.findMany({
    where: { budgetPlanId: { in: planIds }, year: 2026, month: 2, isAllocation: false },
    select: { id: true, name: true, merchantDomain: true, seriesKey: true, categoryId: true, amount: true, paid: true, dueDate: true },
    orderBy: [{ categoryId: "asc" }, { createdAt: "asc" }],
  });

  console.log("\nJAN expenses: " + jan.length);
  const noSeriesKey = [];
  for (const e of jan) {
    const hasKey = !!e.seriesKey;
    if (!hasKey) noSeriesKey.push(e);
    console.log("  [" + (hasKey ? "KEY_OK" : "NO_KEY") + "] " + e.name + " | dom=" + (e.merchantDomain || "-") + " | seriesKey=" + (e.seriesKey || "NULL") + " | cat=" + (e.categoryId || "-") + " | amount=" + Number(e.amount.toString()) + " | paid=" + e.paid + " | id=" + e.id);
  }
  console.log("\nJAN no seriesKey count: " + noSeriesKey.length);

  console.log("\nFEB->JAN match check:");
  for (const f of feb) {
    const febKey = f.seriesKey ? norm(f.seriesKey) : (f.merchantDomain ? norm(f.merchantDomain) : norm(f.name));
    const janMatch = jan.find((j) => {
      if (j.seriesKey && f.seriesKey && norm(j.seriesKey) === norm(f.seriesKey)) return true;
      if (j.seriesKey && norm(j.seriesKey) === febKey) return true;
      if (j.merchantDomain && f.merchantDomain && norm(j.merchantDomain) === norm(f.merchantDomain)) return true;
      if (norm(j.name) === norm(f.name)) return true;
      return false;
    });
    const status = janMatch ? ("MATCH: " + janMatch.name) : "NO_MATCH";
    console.log("  FEB[" + f.name + "] seriesKey=" + (f.seriesKey || "NULL") + " => " + status);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
