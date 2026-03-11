import { deleteJsonCacheByPrefix } from "@/lib/cache/redisJsonCache";
import type { PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_CACHE_TTL_SECONDS = 60;

const DASHBOARD_CACHE_VERSION = "v1";

type DashboardCacheKeyParams = {
	budgetPlanId: string;
	year: number;
	payDate: number;
	payFrequency: PayFrequency;
	periodStart: Date;
	periodEnd: Date;
};

function toIsoDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export function getDashboardCachePrefix(budgetPlanId: string): string {
	return `dashboard:${DASHBOARD_CACHE_VERSION}:${budgetPlanId}:`;
}

export function getDashboardCacheKey(params: DashboardCacheKeyParams): string {
	return [
		getDashboardCachePrefix(params.budgetPlanId).slice(0, -1),
		`year:${params.year}`,
		`pay:${params.payDate}`,
		`freq:${params.payFrequency}`,
		`start:${toIsoDate(params.periodStart)}`,
		`end:${toIsoDate(params.periodEnd)}`,
	].join(":");
}

export async function invalidateDashboardCache(budgetPlanId: string): Promise<void> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return;
	await deleteJsonCacheByPrefix(getDashboardCachePrefix(trimmedBudgetPlanId));
}

export async function invalidateDashboardCacheForUser(userId: string): Promise<void> {
	const trimmedUserId = userId.trim();
	if (!trimmedUserId) return;

	const plans = await prisma.budgetPlan.findMany({
		where: { userId: trimmedUserId },
		select: { id: true },
	});

	await Promise.all(plans.map((plan) => invalidateDashboardCache(plan.id)));
}