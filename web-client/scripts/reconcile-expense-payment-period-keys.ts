/**
 * Reconcile ExpensePayment.periodKey to match Expense.periodKey.
 *
 * Why: older payment rows were stamped using paidAt-based period keys, but the
 * new model expects period attribution to follow the expense's intended period.
 *
 * Dry-run (default):
 *   CHECK_USER="vallis" npx tsx scripts/reconcile-expense-payment-period-keys.ts
 * Apply:
 *   CHECK_USER="vallis" APPLY=1 npx tsx scripts/reconcile-expense-payment-period-keys.ts
 */

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

  const apply = String(process.env.APPLY ?? "").trim() === "1" || process.argv.includes("--apply");
  const needleUser = String(process.env.CHECK_USER ?? "").trim();

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  const userWhere = needleUser
    ? {
        OR: [
          { name: { contains: needleUser, mode: "insensitive" as const } },
          { email: { contains: needleUser, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, email: true, name: true },
  });

  if (!users.length) {
    console.log(needleUser ? `No users matched CHECK_USER=${needleUser}` : "No users found");
    await prisma.$disconnect().catch(() => null);
    return;
  }

  console.log(apply ? "=== APPLY MODE ===" : "=== DRY RUN ===");

  let totalChecked = 0;
  let totalFixable = 0;
  let totalUpdated = 0;

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
          expense: { budgetPlanId: plan.id },
        },
        select: {
          id: true,
          periodKey: true,
          paidAt: true,
          expense: { select: { id: true, name: true, periodKey: true } },
        },
        orderBy: { paidAt: "desc" },
      });

      const mismatches = payments
        .map((p) => {
          const expensePeriodKey = String(p.expense.periodKey ?? "").trim();
          const paymentPeriodKey = String(p.periodKey ?? "").trim();
          const canFix = Boolean(expensePeriodKey);
          const needsFix = canFix && expensePeriodKey !== paymentPeriodKey;
          return {
            paymentId: p.id,
            paidAt: p.paidAt,
            expenseId: p.expense.id,
            expenseName: p.expense.name,
            from: paymentPeriodKey || null,
            to: expensePeriodKey || null,
            canFix,
            needsFix,
          };
        })
        .filter((x) => x.needsFix);

      totalChecked += payments.length;
      totalFixable += mismatches.length;

      if (!mismatches.length) continue;

      console.log("  PLAN", {
        id: plan.id,
        name: plan.name,
        currency: plan.currency,
        payments: payments.length,
        mismatches: mismatches.length,
      });

      for (const row of mismatches.slice(0, 25)) {
        console.log("    MISMATCH", {
          paymentId: row.paymentId,
          paidAt: row.paidAt.toISOString(),
          expenseId: row.expenseId,
          expenseName: row.expenseName,
          from: row.from,
          to: row.to,
        });
      }

      if (apply) {
        for (const row of mismatches) {
          await prisma.expensePayment.update({
            where: { id: row.paymentId },
            data: { periodKey: row.to },
          });
          totalUpdated += 1;
        }
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log({ totalChecked, totalFixable, totalUpdated });

  await prisma.$disconnect().catch(() => null);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exitCode = 1;
});
