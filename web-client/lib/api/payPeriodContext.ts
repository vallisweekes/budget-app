import { prisma } from "@/lib/prisma";
import {
  getPayPeriodAnchorFromWindow,
  normalizePayFrequency,
  resolveActivePayPeriodWindow,
  resolveFirstSelectablePayPeriodWindow,
  type PayFrequency,
} from "@/lib/payPeriods";

function parseMonth(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 1 || value > 12) return null;
  return value;
}

function parseYear(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 1900) return null;
  return value;
}

export async function resolveUserPayPeriodContext(params: {
  userId: string;
  budgetPlanId: string;
  requestedMonth?: unknown;
  requestedYear?: unknown;
  now?: Date;
}): Promise<{
  month: number;
  year: number;
  payDate: number;
  payAnchorDate: string | null;
  payFrequency: PayFrequency;
  window: { start: Date; end: Date };
}> {
  const { userId, budgetPlanId } = params;
  const { userId: ownerUserId, payDate, payAnchorDate, payFrequency, window } = await resolveBudgetPlanPayPeriodContext({
    budgetPlanId,
    now: params.now,
  });

  if (ownerUserId !== userId) {
    throw new Error("Budget plan not found");
  }

  const fallbackAnchor = getPayPeriodAnchorFromWindow({ window, payFrequency });
  const fallbackMonth = fallbackAnchor.anchorMonth;
  const fallbackYear = fallbackAnchor.anchorYear;

  const month = parseMonth(params.requestedMonth) ?? fallbackMonth;
  const year = parseYear(params.requestedYear) ?? fallbackYear;

  return { month, year, payDate, payAnchorDate, payFrequency, window };
}

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

export async function resolveBudgetPlanPayPeriodContext(params: {
  budgetPlanId: string;
  now?: Date;
}): Promise<{
  userId: string;
  payDate: number;
  payAnchorDate: string | null;
  payFrequency: PayFrequency;
  window: { start: Date; end: Date };
  effectiveStartAt: Date | null;
  firstSelectableWindow: { start: Date; end: Date };
}> {
  const plan = await prisma.budgetPlan.findUnique({
    where: { id: params.budgetPlanId },
    select: { payDate: true, userId: true, createdAt: true },
  });

  if (!plan) {
    throw new Error("Budget plan not found");
  }

  const profile = await prisma.userOnboardingProfile.findUnique({
    where: { userId: plan.userId },
    select: { payFrequency: true, payAnchorDate: true, completedAt: true, updatedAt: true, status: true },
  }).catch(() => null);

  const payDateRaw = Number(plan.payDate ?? 27);
  const payDate = Number.isFinite(payDateRaw) && payDateRaw >= 1 ? Math.floor(payDateRaw) : 27;
  const payAnchorDate = profile?.payAnchorDate instanceof Date ? profile.payAnchorDate.toISOString() : null;
  const payFrequency = normalizePayFrequency(profile?.payFrequency);
  const effectiveStartAt = latestDate(
    plan.createdAt,
    profile?.completedAt ?? null,
    profile?.status === "completed" ? profile?.updatedAt ?? null : null,
  );
  const firstSelectableReferenceAt = latestDate(
    plan.createdAt,
    profile?.completedAt ?? null,
  );
  const now = params.now ?? new Date();

  return {
    userId: plan.userId,
    payDate,
    payAnchorDate,
    payFrequency,
    window: resolveActivePayPeriodWindow({ now, payDate, payAnchorDate, payFrequency, planCreatedAt: effectiveStartAt }),
    effectiveStartAt,
    firstSelectableWindow: resolveFirstSelectablePayPeriodWindow({
      payDate,
      payAnchorDate,
      payFrequency,
      planStartAt: firstSelectableReferenceAt,
    }),
  };
}
