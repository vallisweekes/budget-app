import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvIfPresent(cwd: string) {
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
  ];

  for (const file of envFiles) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

function resolveDbUrl(): string | undefined {
  return process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
}

function parseIntList(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

function toIsoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

async function main() {
  loadDotEnvIfPresent(process.cwd());
  const dbUrl = resolveDbUrl();
  if (!dbUrl) {
    console.error(
      "No DB URL found. Set POSTGRES_PRISMA_URL or DATABASE_URL (or add it to web-client/.env.local) and rerun."
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  const needleUser = (process.env.CHECK_USER ?? "vallis").trim();
  const amountStr = (process.env.CHECK_AMOUNT ?? "79").trim();
  const amount = new Prisma.Decimal(amountStr);

  const now = new Date();
  const year = Number.parseInt((process.env.CHECK_YEAR ?? String(now.getUTCFullYear())).trim(), 10);
  const months = parseIntList((process.env.CHECK_MONTHS ?? "1,2").trim());
  const filteredMonths = months.filter((m) => m >= 1 && m <= 12);

  const startMonth = filteredMonths.length ? Math.min(...filteredMonths) : 1;
  const endMonth = filteredMonths.length ? Math.max(...filteredMonths) : 12;

  const rangeStart = new Date(Date.UTC(year, startMonth - 1, 1, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(year, endMonth, 1, 0, 0, 0, 0)); // first of month after endMonth

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: needleUser, mode: "insensitive" } },
        { email: { contains: needleUser, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, name: true },
  });

  if (!users.length) {
    console.log(`No users matched CHECK_USER=${needleUser}`);
    await prisma.$disconnect().catch(() => null);
    return;
  }

  console.log("Searching", {
    needleUser,
    amount: amountStr,
    year,
    months: filteredMonths.length ? filteredMonths : undefined,
    paidAtRange: { gte: rangeStart.toISOString(), lt: rangeEnd.toISOString() },
  });

  for (const user of users) {
    console.log("\nUSER", { id: user.id, email: user.email, name: user.name });

    const plans = await prisma.budgetPlan.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, currency: true },
      orderBy: { createdAt: "asc" },
    });

    for (const plan of plans) {
      const payments = await prisma.expensePayment.findMany({
        where: {
          amount: { equals: amount },
          paidAt: { gte: rangeStart, lt: rangeEnd },
          expense: { budgetPlanId: plan.id },
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          source: true,
          periodKey: true,
          expense: {
            select: {
              id: true,
              name: true,
              month: true,
              year: true,
              dueDate: true,
              periodKey: true,
              amount: true,
              categoryId: true,
              isMovedToDebt: true,
              isAllocation: true,
              isDirectDebit: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { paidAt: "desc" },
      });

      if (!payments.length) continue;

      console.log("  PLAN", { id: plan.id, name: plan.name, currency: plan.currency, matches: payments.length });
      for (const p of payments) {
        console.log("    PAYMENT", {
          id: p.id,
          amount: p.amount.toString(),
          paidAt: toIsoDate(p.paidAt),
          source: p.source,
          periodKey: p.periodKey,
          expense: {
            id: p.expense.id,
            name: p.expense.name,
            ym: `${p.expense.year}-${String(p.expense.month).padStart(2, "0")}`,
            dueDate: p.expense.dueDate ? p.expense.dueDate.toISOString().slice(0, 10) : null,
            periodKey: p.expense.periodKey,
            amount: p.expense.amount.toString(),
            categoryId: p.expense.categoryId,
            categoryName: p.expense.category?.name ?? null,
            isMovedToDebt: Boolean((p.expense as unknown as { isMovedToDebt?: unknown }).isMovedToDebt),
            isAllocation: Boolean((p.expense as unknown as { isAllocation?: unknown }).isAllocation),
            isDirectDebit: Boolean((p.expense as unknown as { isDirectDebit?: unknown }).isDirectDebit),
          },
        });
      }
    }
  }

  await prisma.$disconnect().catch(() => null);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exitCode = 1;
});
