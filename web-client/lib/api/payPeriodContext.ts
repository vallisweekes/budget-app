import { prisma } from "@/lib/prisma";
import { normalizePayFrequency, resolveActivePayPeriodWindow, type PayFrequency } from "@/lib/payPeriods";

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
  payFrequency: PayFrequency;
  window: { start: Date; end: Date };
}> {
  const { userId, budgetPlanId } = params;

  const [plan, profile] = await Promise.all([
    prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { payDate: true, userId: true } }),
    prisma.userOnboardingProfile.findUnique({ where: { userId }, select: { payFrequency: true } }).catch(() => null),
  ]);

  if (!plan || plan.userId !== userId) {
    throw new Error("Budget plan not found");
  }

  const payDateRaw = Number(plan.payDate ?? 27);
  const payDate = Number.isFinite(payDateRaw) && payDateRaw >= 1 ? Math.floor(payDateRaw) : 27;
  const payFrequency = normalizePayFrequency(profile?.payFrequency);

  const now = params.now ?? new Date();
  const window = resolveActivePayPeriodWindow({ now, payDate, payFrequency });
  const fallbackMonth = window.end.getUTCMonth() + 1;
  const fallbackYear = window.end.getUTCFullYear();

  const month = parseMonth(params.requestedMonth) ?? fallbackMonth;
  const year = parseYear(params.requestedYear) ?? fallbackYear;

  return { month, year, payDate, payFrequency, window };
}
