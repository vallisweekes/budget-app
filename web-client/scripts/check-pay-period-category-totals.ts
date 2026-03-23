import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "../lib/payPeriods";
import { resolveEffectiveDueDateIso } from "../lib/expenses/insights";

function includeInMainExpenseSummary(expense: {
  isExtraLoggedExpense?: boolean | null;
  paymentSource?: string | null;
}): boolean {
  if (!Boolean(expense.isExtraLoggedExpense ?? false)) return true;
  return String(expense.paymentSource ?? "income").trim().toLowerCase() === "income";
}

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
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

function resolveDbUrl(): string | undefined {
  return process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
}

function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number((value as { toString?: () => string })?.toString?.() ?? value);
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function inRange(target: Date, start: Date, end: Date): boolean {
  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

async function main() {
  loadDotEnvIfPresent(process.cwd());
  const dbUrl = resolveDbUrl();
  if (!dbUrl) {
    console.error("No DB URL found");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const needleUser = (process.env.CHECK_USER ?? "vallis.weekes").trim();
  const anchorMonth = Number(process.env.CHECK_MONTH ?? "3");
  const anchorYear = Number(process.env.CHECK_YEAR ?? "2026");

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { contains: needleUser, mode: "insensitive" } },
        { email: { contains: needleUser, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    console.log(`No user matched ${needleUser}`);
    await prisma.$disconnect().catch(() => null);
    return;
  }

  const [plan, onboarding] = await Promise.all([
    prisma.budgetPlan.findFirst({ where: { userId: user.id, kind: "personal" }, select: { id: true, name: true, payDate: true } }),
    prisma.userOnboardingProfile.findUnique({ where: { userId: user.id }, select: { payFrequency: true } }),
  ]);

  if (!plan) {
    console.log("No personal plan found", user);
    await prisma.$disconnect().catch(() => null);
    return;
  }

  const payDate = Number.isFinite(Number(plan.payDate)) && Number(plan.payDate) >= 1 ? Math.floor(Number(plan.payDate)) : 1;
  const payFrequency: PayFrequency = normalizePayFrequency(onboarding?.payFrequency);

  const period = buildPayPeriodFromMonthAnchor({
    anchorYear,
    anchorMonth,
    payDate,
    payFrequency,
  });

  const allowedUnscheduledYm = new Set([
    `${period.start.getUTCFullYear()}-${period.start.getUTCMonth() + 1}`,
    `${period.end.getUTCFullYear()}-${period.end.getUTCMonth() + 1}`,
  ]);

  const windowPairs = [
    { year: period.start.getUTCFullYear(), month: period.start.getUTCMonth() + 1 },
    { year: period.end.getUTCFullYear(), month: period.end.getUTCMonth() + 1 },
    {
      year: new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() - 1, 1)).getUTCFullYear(),
      month: new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
    },
    {
      year: new Date(Date.UTC(period.end.getUTCFullYear(), period.end.getUTCMonth() + 1, 1)).getUTCFullYear(),
      month: new Date(Date.UTC(period.end.getUTCFullYear(), period.end.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
    },
  ];
  const uniquePairs = Array.from(new Map(windowPairs.map((p) => [`${p.year}-${p.month}`, p])).values());

  const rows = await prisma.expense.findMany({
    where: {
      budgetPlanId: plan.id,
      OR: uniquePairs,
      isMovedToDebt: false,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const seen = new Map<string, { exp: (typeof rows)[number]; rank: number }>();

  for (const exp of rows) {
    if (Boolean((exp as unknown as { isAllocation?: unknown }).isAllocation)) continue;
    if (!includeInMainExpenseSummary(exp as unknown as { isExtraLoggedExpense?: boolean | null; paymentSource?: string | null })) {
      continue;
    }

    let dedupeScope = "";
    let rank = 1;

    if (exp.dueDate) {
      const dueIso = resolveEffectiveDueDateIso(
        {
          id: exp.id,
          name: exp.name,
          amount: toNum(exp.amount),
          paid: Boolean(exp.paid),
          paidAmount: toNum(exp.paidAmount),
          dueDate: exp.dueDate.toISOString().slice(0, 10),
        },
        { year: exp.year, monthNum: exp.month, payDate }
      );
      if (!dueIso) continue;
      const due = parseIsoDate(dueIso);
      if (!due) continue;
      if (!inRange(due, period.start, period.end)) continue;
      dedupeScope = dueIso;
      const ym = { year: Number(dueIso.slice(0, 4)), month: Number(dueIso.slice(5, 7)) };
      rank = exp.year === ym.year && exp.month === ym.month ? 0 : 1;
    } else {
      if (!allowedUnscheduledYm.has(`${exp.year}-${exp.month}`)) continue;
      dedupeScope = `unscheduled:${exp.year}-${exp.month}`;
      rank = 0;
    }

    const series = String((exp as unknown as { seriesKey?: unknown }).seriesKey ?? exp.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const amount = toNum(exp.amount);
    const key = `${series}|${dedupeScope}|${amount}`;

    const existing = seen.get(key);
    if (!existing || rank < existing.rank) {
      seen.set(key, { exp, rank });
    }
  }

  const included = Array.from(seen.values()).map((v) => v.exp);
  const total = included.reduce((s, e) => s + toNum(e.amount), 0);
  const byCategory = new Map<string, number>();

  for (const e of included) {
    const name = e.category?.name ?? "Uncategorised";
    byCategory.set(name, (byCategory.get(name) ?? 0) + toNum(e.amount));
  }

  console.log("PERIOD", {
    user,
    plan: { id: plan.id, name: plan.name },
    payDate,
    payFrequency,
    start: period.start.toISOString().slice(0, 10),
    end: period.end.toISOString().slice(0, 10),
    includedCount: included.length,
    total: Number(total.toFixed(2)),
  });

  const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
  for (const [name, amount] of sorted) {
    console.log("CATEGORY", { name, amount: Number(amount.toFixed(2)) });
  }

  const apple = included.filter((e) => /apple developer/i.test(e.name));
  console.log("APPLE_IN_INCLUDED", apple.map((e) => ({
    id: e.id,
    name: e.name,
    amount: toNum(e.amount),
    month: e.month,
    year: e.year,
    category: e.category?.name ?? "Uncategorised",
    isAllocation: Boolean((e as unknown as { isAllocation?: unknown }).isAllocation),
  })));

  await prisma.$disconnect().catch(() => null);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exitCode = 1;
});
