import { resolveBudgetPlanPayPeriodContext } from "@/lib/api/payPeriodContext";
import { resolveExpenseDueDate } from "@/lib/expenses/carryover/shared";
import { syncExpensePaymentsToPaidAmount } from "@/lib/expenses/paymentSync";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { prisma } from "@/lib/prisma";

type DirectDebitExpenseIdentity = {
  id: string;
  name: string;
  seriesKey?: string | null;
  categoryId?: string | null;
  isDirectDebit?: boolean | null;
};

type DirectDebitCandidateRow = DirectDebitExpenseIdentity & {
  amount: unknown;
  paid: boolean;
  paidAmount: unknown;
  dueDate: Date | null;
  month: number;
  year: number;
  paymentSource?: string | null;
  cardDebtId?: string | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  const asObject = value as { toString?: () => string } | null;
  return Number(asObject?.toString?.() ?? value ?? 0);
}

function normalizeSeriesKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 160);
}

function normalizeLegacyName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toLocalNoon(value: Date): Date {
  const next = new Date(value);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function buildDirectDebitSeriesIdentity(expense: {
  seriesKey?: unknown;
  name?: unknown;
  categoryId?: unknown;
}): string | null {
  const seriesKey = normalizeSeriesKey(expense.seriesKey);
  if (seriesKey) return `series:${seriesKey}`;

  const name = normalizeLegacyName(expense.name);
  if (!name) return null;

  return `legacy:${name}|${String(expense.categoryId ?? "")}`;
}

async function getDirectDebitSeriesIdentitySet(budgetPlanId: string): Promise<Set<string>> {
  const directDebitRows = await prisma.expense.findMany({
    where: { budgetPlanId, isDirectDebit: true },
    select: { seriesKey: true, name: true, categoryId: true },
  });

  return new Set(
    directDebitRows
      .map((row) => buildDirectDebitSeriesIdentity(row))
      .filter((value): value is string => Boolean(value))
  );
}

export async function getEffectiveDirectDebitByExpenseId(params: {
  budgetPlanId: string;
  expenses: DirectDebitExpenseIdentity[];
}): Promise<Map<string, boolean>> {
  const effectiveByExpenseId = new Map<string, boolean>();
  if (params.expenses.length === 0) return effectiveByExpenseId;

  const directDebitSeriesIdentitySet = await getDirectDebitSeriesIdentitySet(params.budgetPlanId);

  for (const expense of params.expenses) {
    const seriesIdentity = buildDirectDebitSeriesIdentity(expense);
    const isEffectiveDirectDebit =
      Boolean(expense.isDirectDebit) ||
      (seriesIdentity !== null && directDebitSeriesIdentitySet.has(seriesIdentity));
    effectiveByExpenseId.set(expense.id, isEffectiveDirectDebit);
  }

  return effectiveByExpenseId;
}

export async function syncDueDirectDebitExpenses(params: {
  budgetPlanId: string;
  now?: Date;
}): Promise<string[]> {
  const now = params.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const payPeriodContext = await resolveBudgetPlanPayPeriodContext({
    budgetPlanId: params.budgetPlanId,
    now,
  });
  const defaultDueDay =
    Number.isFinite(Number(payPeriodContext.payDate)) && Number(payPeriodContext.payDate) >= 1
      ? Math.floor(Number(payPeriodContext.payDate))
      : 27;

  const candidates = await (async (): Promise<DirectDebitCandidateRow[]> => {
    const baseWhere = {
      budgetPlanId: params.budgetPlanId,
      isAllocation: false,
      paid: false,
      OR: [{ year: { lt: currentYear } }, { year: currentYear, month: { lte: currentMonth } }],
    };

    const baseSelect = {
      id: true,
      name: true,
      seriesKey: true,
      categoryId: true,
      isDirectDebit: true,
      amount: true,
      paid: true,
      paidAmount: true,
      dueDate: true,
      month: true,
      year: true,
      paymentSource: true,
      cardDebtId: true,
    } as const;

    if (!(await supportsExpenseMovedToDebtField())) {
      return prisma.expense.findMany({
        where: baseWhere,
        select: baseSelect,
      }) as Promise<DirectDebitCandidateRow[]>;
    }

    return prisma.expense.findMany({
      where: {
        ...baseWhere,
        isMovedToDebt: false,
      },
      select: baseSelect,
    }) as Promise<DirectDebitCandidateRow[]>;
  })();

  if (candidates.length === 0) return [];

  const effectiveDirectDebitByExpenseId = await getEffectiveDirectDebitByExpenseId({
    budgetPlanId: params.budgetPlanId,
    expenses: candidates,
  });

  const updatedExpenseIds: string[] = [];
  for (const expense of candidates) {
    if (!effectiveDirectDebitByExpenseId.get(expense.id)) continue;

    const amount = toNumber(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const dueDate = resolveExpenseDueDate({
      year: expense.year,
      month: expense.month,
      dueDate: expense.dueDate,
      defaultDueDay,
    });
    if (dueDate.getTime() > today.getTime()) continue;

    const currentPaidAmount = toNumber(expense.paidAmount);
    const currentIsPaid = amount > 0 && currentPaidAmount >= amount - 0.005;
    const paidAt = toLocalNoon(dueDate);

    const syncResult = await prisma.$transaction(async (tx) => {
      const synced = await syncExpensePaymentsToPaidAmount({
        tx,
        expenseId: expense.id,
        budgetPlanId: params.budgetPlanId,
        amount,
        desiredPaidAmount: amount,
        paymentSource: expense.paymentSource ?? "income",
        cardDebtId: expense.cardDebtId ?? null,
        now: paidAt,
        adjustBalances: true,
        resetOnDecrease: false,
      });

      const shouldUpdateExpense =
        synced.didChangePayments ||
        !currentIsPaid ||
        !expense.paid ||
        Math.abs(currentPaidAmount - synced.finalPaidAmount) > 1e-9 ||
        !expense.isDirectDebit;

      if (shouldUpdateExpense) {
        await tx.expense.update({
          where: { id: expense.id },
          data: {
            paid: synced.finalPaid,
            paidAmount: String(synced.finalPaidAmount),
            lastPaymentAt: paidAt,
            isDirectDebit: true,
          },
        });
      }

      return {
        synced,
        shouldUpdateExpense,
      };
    });

    if (syncResult.synced.finalPaid && (syncResult.synced.didChangePayments || syncResult.shouldUpdateExpense)) {
      updatedExpenseIds.push(expense.id);
    }
  }

  return updatedExpenseIds;
}