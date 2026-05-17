import { getPeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";
import { prisma } from "@/lib/prisma";

type MoneyLike = number | string | null | undefined | { toString?: () => string; toNumber?: () => number };

export type DebtPlannedPaymentOverrideRow = {
  periodKey: string;
  year: number;
  month: number;
  amount: number;
};

function toNumber(value: MoneyLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object") {
    if (typeof value.toNumber === "function") return value.toNumber();
    if (typeof value.toString === "function") return Number(value.toString());
  }
  return Number(value);
}

function resolveReferenceDate(date?: Date | null, now = new Date()): Date {
  if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  return now;
}

function clampDay(year: number, month0: number, day: number): number {
  const maxDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.max(1, Math.min(maxDay, Math.floor(day)));
}

function resolveReferenceDay(params: {
  dueDate?: Date | null;
  dueDay?: number | null;
  now?: Date;
}): number {
  if (params.dueDate instanceof Date && Number.isFinite(params.dueDate.getTime())) {
    return params.dueDate.getUTCDate();
  }

  if (Number.isFinite(params.dueDay) && Number(params.dueDay) >= 1) {
    return Math.floor(Number(params.dueDay));
  }

  return resolveReferenceDate(params.dueDate, params.now).getUTCDate();
}

function getDebtPlannedPaymentOverrideModel() {
  return (prisma as typeof prisma & {
    debtPlannedPaymentOverride?: {
      findMany: typeof prisma.debtPayment.findMany;
    };
  }).debtPlannedPaymentOverride;
}

export async function resolveDebtPlannedPaymentTarget(params: {
  budgetPlanId: string;
  dueDate?: Date | null;
  dueDay?: number | null;
  targetPeriodKey?: string | null;
  targetYear?: number | null;
  targetMonth?: number | null;
  now?: Date;
}): Promise<{ periodKey: string; year: number; month: number }> {
  if (typeof params.targetPeriodKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.targetPeriodKey)) {
    const start = new Date(`${params.targetPeriodKey}T00:00:00.000Z`);
    if (Number.isFinite(start.getTime())) {
      return {
        periodKey: params.targetPeriodKey,
        year: start.getUTCFullYear(),
        month: start.getUTCMonth() + 1,
      };
    }
  }

  const referenceDate = Number.isFinite(params.targetYear) && Number.isFinite(params.targetMonth)
    ? (() => {
        const year = Number(params.targetYear);
        const month = Number(params.targetMonth);
        const month0 = month - 1;
        const day = resolveReferenceDay(params);
        return new Date(Date.UTC(year, month0, clampDay(year, month0, day)));
      })()
    : resolveReferenceDate(params.dueDate, params.now);
  const payDate = await resolvePayDate(params.budgetPlanId);

  return {
    periodKey: getPeriodKey(referenceDate, payDate),
    year: referenceDate.getUTCFullYear(),
    month: referenceDate.getUTCMonth() + 1,
  };
}

export async function getDebtPlannedPaymentOverridesForPeriod(params: {
  debtIds: string[];
  periodKey?: string;
  year?: number;
  month?: number;
}): Promise<Map<string, number>> {
  if (!params.debtIds.length) return new Map();

  const debtPlannedPaymentOverrideModel = getDebtPlannedPaymentOverrideModel();
  if (!debtPlannedPaymentOverrideModel?.findMany) return new Map();

  const where = params.periodKey
    ? { debtId: { in: params.debtIds }, periodKey: params.periodKey }
    : (Number.isFinite(params.year) && Number.isFinite(params.month)
        ? {
            debtId: { in: params.debtIds },
            year: Number(params.year),
            month: Number(params.month),
          }
        : null);

  if (!where) return new Map();

  const rows = await debtPlannedPaymentOverrideModel.findMany({
    where,
    select: {
      debtId: true,
      amount: true,
    },
  });

  return new Map(rows.map((row) => [row.debtId, Math.max(0, toNumber(row.amount))]));
}

export async function listDebtPlannedPaymentOverridesForDebt(debtId: string): Promise<DebtPlannedPaymentOverrideRow[]> {
  const debtPlannedPaymentOverrideModel = getDebtPlannedPaymentOverrideModel();
  if (!debtPlannedPaymentOverrideModel?.findMany) return [];

  const rows = await debtPlannedPaymentOverrideModel.findMany({
    where: { debtId },
    select: {
      periodKey: true,
      year: true,
      month: true,
      amount: true,
    },
    orderBy: [
      { periodKey: "asc" },
      { year: "asc" },
      { month: "asc" },
    ],
  });

  return rows.map((row) => ({
    periodKey: row.periodKey,
    year: Number(row.year),
    month: Number(row.month),
    amount: Math.max(0, toNumber(row.amount)),
  }));
}