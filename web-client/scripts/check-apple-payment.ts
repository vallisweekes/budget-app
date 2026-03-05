import { PrismaClient } from "@prisma/client";
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

function decToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object") {
    const maybe = value as { toNumber?: () => number; toString?: () => string };
    if (typeof maybe.toNumber === "function") return maybe.toNumber();
    if (typeof maybe.toString === "function") return Number(maybe.toString());
  }
  return Number(value);
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
    datasources: {
      db: { url: dbUrl },
    },
  });

  const needleUser = (process.env.CHECK_USER ?? "vallis").trim();
  const needleExpenseRaw = (process.env.CHECK_EXPENSE ?? "apple").trim();
  const expenseNeedles = needleExpenseRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
    return;
  }

  for (const user of users) {
    console.log("\nUSER", { id: user.id, email: user.email, name: user.name });

    const plans = await prisma.budgetPlan.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, currency: true },
      orderBy: { createdAt: "asc" },
    });

    for (const plan of plans) {
      console.log("  PLAN", { id: plan.id, name: plan.name, currency: plan.currency });

      const expenses = await prisma.expense.findMany({
        where: {
          budgetPlanId: plan.id,
          OR: expenseNeedles.map((needle) => ({ name: { contains: needle, mode: "insensitive" as const } })),
          isAllocation: false,
        },
        select: {
          id: true,
          name: true,
          amount: true,
          month: true,
          year: true,
          dueDate: true,
          paidAmount: true,
          paid: true,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
      });

      if (!expenses.length) {
        console.log("    (no matching expenses)");
        continue;
      }

      for (const exp of expenses) {
        const payments = await prisma.expensePayment.findMany({
          where: { expenseId: exp.id },
          select: { id: true, amount: true, paidAt: true, source: true, debtId: true },
          orderBy: { paidAt: "desc" },
        });

        const amount = decToNumber(exp.amount);
        const paidScalar = decToNumber(exp.paidAmount);
        const paidCanonical = payments.reduce((s, p) => s + decToNumber(p.amount), 0);

        console.log("    EXPENSE", {
          id: exp.id,
          name: exp.name,
          ym: `${exp.year}-${String(exp.month).padStart(2, "0")}`,
          dueDate: exp.dueDate ? exp.dueDate.toISOString().slice(0, 10) : null,
          amount,
          paidScalarFlag: Boolean(exp.paid),
          paidScalarAmount: paidScalar,
          paymentsCount: payments.length,
          paymentsSum: paidCanonical,
        });

        for (const p of payments.slice(0, 25)) {
          console.log("      PAYMENT", {
            id: p.id,
            amount: decToNumber(p.amount),
            paidAt: p.paidAt.toISOString(),
            source: p.source,
            debtId: p.debtId,
          });
        }
      }
    }
  }

  await prisma.$disconnect().catch(() => null);
}

main()
  .catch((err) => {
    console.error("FAILED", err);
    process.exitCode = 1;
  })
  .finally(() => undefined);
