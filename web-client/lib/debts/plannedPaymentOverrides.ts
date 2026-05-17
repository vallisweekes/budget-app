import { getPeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";
import { prisma } from "@/lib/prisma";

type MoneyLike = number | string | null | undefined | { toString?: () => string; toNumber?: () => number };

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

export async function resolveDebtPlannedPaymentTarget(params: {
  budgetPlanId: string;
  dueDate?: Date | null;
  now?: Date;
}): Promise<{ periodKey: string; year: number; month: number }> {
  const referenceDate = resolveReferenceDate(params.dueDate, params.now);
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

  const debtPlannedPaymentOverrideModel = (prisma as typeof prisma & {
    debtPlannedPaymentOverride?: {
      findMany: typeof prisma.debtPayment.findMany;
    };
  }).debtPlannedPaymentOverride;
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