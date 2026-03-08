import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type ParsedArgs = Record<string, string>;

type CandidateKind = "exact" | "likely-income";

type CandidateReason =
  | "receipt-linked"
  | "non-income-paid-no-due-date"
  | "income-paid-no-due-date";

type CandidateRow = {
  id: string;
  name: string;
  amount: string;
  paid: boolean;
  paidAmount: string;
  paymentSource: string;
  cardDebtId: string | null;
  periodKey: string | null;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
  budgetPlanId: string;
  budgetPlanName: string | null;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  receiptLinked: boolean;
  paymentCount: number;
  nonIncomePaymentCount: number;
  kind: CandidateKind;
  reason: CandidateReason;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
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
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

function resolveDbUrl(): string | undefined {
  return (
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL_NON_POOLING?.replace?.("postgres://", "postgresql://") ||
    undefined
  );
}

function toNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: Date | null | undefined): string {
  return value instanceof Date ? value.toISOString() : "";
}

function normalizeSource(value: unknown): string {
  return String(value ?? "income").trim().toLowerCase() || "income";
}

function formatYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function matchesNeedle(value: string | null | undefined, needle: string | null): boolean {
  if (!needle) return true;
  return String(value ?? "").toLowerCase().includes(needle);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function printSummary(label: string, rows: CandidateRow[]) {
  const byReason = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.reason] = (acc[row.reason] ?? 0) + 1;
    return acc;
  }, {});
  const byPlan = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.budgetPlanName ?? "Unnamed plan"} (${row.budgetPlanId})`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n${label}: ${rows.length}`);
  if (!rows.length) return;

  console.log("  By reason:");
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`    - ${reason}: ${count}`);
  }

  console.log("  By plan:");
  for (const [plan, count] of Object.entries(byPlan).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    - ${plan}: ${count}`);
  }
}

function printSamples(label: string, rows: CandidateRow[], limit: number) {
  console.log(`\n${label} samples (${Math.min(rows.length, limit)} of ${rows.length}):`);
  if (!rows.length) {
    console.log("  none");
    return;
  }

  for (const row of rows.slice(0, limit)) {
    console.log(
      JSON.stringify(
        {
          id: row.id,
          name: row.name,
          amount: row.amount,
          ym: formatYm(row.year, row.month),
          paid: row.paid,
          paidAmount: row.paidAmount,
          paymentSource: row.paymentSource,
          paymentCount: row.paymentCount,
          nonIncomePaymentCount: row.nonIncomePaymentCount,
          receiptLinked: row.receiptLinked,
          periodKey: row.periodKey,
          plan: row.budgetPlanName,
          userEmail: row.userEmail,
          reason: row.reason,
          createdAt: row.createdAt,
        },
        null,
        2,
      ),
    );
  }
}

async function main() {
  loadDotEnvIfPresent(process.cwd());

  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === "true";
  const includeLikelyIncome = args["include-likely-income"] === "true";
  const planFilter = args.plan?.trim() || null;
  const userFilter = args.user?.trim().toLowerCase() || null;
  const sampleLimit = Math.max(1, Math.min(50, Number.parseInt(args.samples ?? "12", 10) || 12));

  const dbUrl = resolveDbUrl();
  if (!dbUrl) {
    throw new Error(
      "No DB URL found. Set POSTGRES_PRISMA_URL or DATABASE_URL (or add it to web-client/.env.local) and rerun.",
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        isExtraLoggedExpense: false,
        isAllocation: false,
        isDirectDebit: false,
        isMovedToDebt: false,
        dueDate: null,
        ...(planFilter ? { budgetPlanId: planFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        amount: true,
        paid: true,
        paidAmount: true,
        paymentSource: true,
        cardDebtId: true,
        periodKey: true,
        month: true,
        year: true,
        createdAt: true,
        updatedAt: true,
        budgetPlanId: true,
        budgetPlan: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const filteredExpenses = userFilter
      ? expenses.filter((row) => (
          matchesNeedle(row.budgetPlan.user.email, userFilter) ||
          matchesNeedle(row.budgetPlan.user.name, userFilter)
        ))
      : expenses;

    if (!filteredExpenses.length) {
      console.log("No unflagged no-due-date expense rows matched the requested filters.");
      return;
    }

    const expenseIds = filteredExpenses.map((row) => row.id);

    const [payments, receipts] = await Promise.all([
      prisma.expensePayment.findMany({
        where: { expenseId: { in: expenseIds } },
        select: { expenseId: true, source: true },
      }),
      prisma.receipt.findMany({
        where: { expenseId: { in: expenseIds } },
        select: { expenseId: true },
      }),
    ]);

    const paymentsByExpense = new Map<string, Array<{ source: string }>>();
    for (const payment of payments) {
      const bucket = paymentsByExpense.get(payment.expenseId) ?? [];
      bucket.push({ source: normalizeSource(payment.source) });
      paymentsByExpense.set(payment.expenseId, bucket);
    }

    const receiptExpenseIds = new Set(receipts.map((row) => row.expenseId).filter((value): value is string => Boolean(value)));

    const exact: CandidateRow[] = [];
    const likelyIncome: CandidateRow[] = [];
    let inspected = 0;
    let skippedWithoutSpendSignal = 0;

    for (const row of filteredExpenses) {
      inspected += 1;
      const rowPayments = paymentsByExpense.get(row.id) ?? [];
      const normalizedPaymentSource = normalizeSource(row.paymentSource);
      const receiptLinked = receiptExpenseIds.has(row.id);
      const paymentCount = rowPayments.length;
      const nonIncomePaymentCount = rowPayments.filter((payment) => payment.source !== "income").length;
      const paidAmount = toNumber(row.paidAmount);
      const hasSpendSignal = receiptLinked || row.paid || paidAmount > 0 || paymentCount > 0;

      if (!hasSpendSignal) {
        skippedWithoutSpendSignal += 1;
        continue;
      }

      const candidate: CandidateRow = {
        id: row.id,
        name: row.name,
        amount: String(row.amount),
        paid: Boolean(row.paid),
        paidAmount: String(row.paidAmount),
        paymentSource: normalizedPaymentSource,
        cardDebtId: row.cardDebtId,
        periodKey: row.periodKey,
        month: row.month,
        year: row.year,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
        budgetPlanId: row.budgetPlanId,
        budgetPlanName: row.budgetPlan.name ?? null,
        userId: row.budgetPlan.user.id,
        userEmail: row.budgetPlan.user.email ?? null,
        userName: row.budgetPlan.user.name ?? null,
        receiptLinked,
        paymentCount,
        nonIncomePaymentCount,
        kind: "exact",
        reason: "receipt-linked",
      };

      if (receiptLinked) {
        candidate.kind = "exact";
        candidate.reason = "receipt-linked";
        exact.push(candidate);
        continue;
      }

      const hasNonIncomeSignal =
        normalizedPaymentSource !== "income" ||
        Boolean(row.cardDebtId) ||
        nonIncomePaymentCount > 0;

      if (hasNonIncomeSignal) {
        candidate.kind = "exact";
        candidate.reason = "non-income-paid-no-due-date";
        exact.push(candidate);
        continue;
      }

      candidate.kind = "likely-income";
      candidate.reason = "income-paid-no-due-date";
      likelyIncome.push(candidate);
    }

    console.log("Logged-expense flag audit");
    console.log(
      JSON.stringify(
        {
          filters: {
            plan: planFilter,
            user: userFilter,
          },
          scannedNoDueDateRows: filteredExpenses.length,
          inspected,
          skippedWithoutSpendSignal,
          exactCandidates: exact.length,
          likelyIncomeCandidates: likelyIncome.length,
          apply,
          includeLikelyIncome,
        },
        null,
        2,
      ),
    );

    printSummary("Exact backfill candidates", exact);
    printSummary("Likely income-funded candidates", likelyIncome);
    printSamples("Exact backfill", exact, sampleLimit);
    printSamples("Likely income-funded", likelyIncome, sampleLimit);

    if (!apply) {
      console.log("\nDry run only. Re-run with --apply to update exact candidates.");
      console.log("Add --include-likely-income to also backfill the ambiguous income-funded rows.");
      return;
    }

    const targetIds = [
      ...exact.map((row) => row.id),
      ...(includeLikelyIncome ? likelyIncome.map((row) => row.id) : []),
    ];

    if (!targetIds.length) {
      console.log("\nNo rows qualified for update.");
      return;
    }

    let updated = 0;
    for (const idChunk of chunk(targetIds, 250)) {
      const result = await prisma.expense.updateMany({
        where: {
          id: { in: idChunk },
          isExtraLoggedExpense: false,
        },
        data: {
          isExtraLoggedExpense: true,
        },
      });
      updated += result.count;
    }

    console.log(`\nUpdated rows: ${updated}`);
    console.log(`Exact updated: ${exact.length}`);
    console.log(`Likely income updated: ${includeLikelyIncome ? likelyIncome.length : 0}`);
  } finally {
    await prisma.$disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error("FAILED", error);
  process.exitCode = 1;
});