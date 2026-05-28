import { deleteJsonCacheByPrefix, getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import type { PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_CACHE_TTL_SECONDS = 60;
export const DEBT_SUMMARY_CACHE_TTL_SECONDS = 60;
export const EXPENSE_INSIGHTS_CACHE_TTL_SECONDS = 60;
export const DASHBOARD_VERSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const DASHBOARD_CACHE_VERSION = "v2";
const DEBT_SUMMARY_CACHE_VERSION = "v2";
const EXPENSE_INSIGHTS_CACHE_VERSION = "v2";
const DASHBOARD_VERSION_CACHE_VERSION = "v1";

export type DashboardVersionPayload = {
	version: string;
	changedAt: string;
};

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

export function getDashboardVersionCacheKey(budgetPlanId: string): string {
	return `dashboard-version:${DASHBOARD_VERSION_CACHE_VERSION}:${budgetPlanId}`;
}

export function getDebtSummaryCachePrefix(budgetPlanId: string): string {
	return `debt-summary:${DEBT_SUMMARY_CACHE_VERSION}:${budgetPlanId}:`;
}

export function getExpenseInsightsCachePrefix(budgetPlanId: string): string {
	return `expense-insights:${EXPENSE_INSIGHTS_CACHE_VERSION}:${budgetPlanId}:`;
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

export function getDebtSummaryCacheKey(params: {
	budgetPlanId: string;
	periodKey: string;
	includeExpenseDebts: boolean;
}): string {
	return [
		getDebtSummaryCachePrefix(params.budgetPlanId).slice(0, -1),
		`period:${params.periodKey}`,
		`expense:${params.includeExpenseDebts ? "1" : "0"}`,
	].join(":");
}

export function getExpenseInsightsCacheKey(params: {
	budgetPlanId: string;
	periodKey: string;
}): string {
	return [
		getExpenseInsightsCachePrefix(params.budgetPlanId).slice(0, -1),
		`period:${params.periodKey}`,
	].join(":");
}

export function logDerivedSummaryCacheEvent(params: {
	route: "dashboard" | "debt-summary" | "expense-insights";
	status: "hit" | "miss" | "store";
	key: string;
	budgetPlanId: string;
}): void {
	if (process.env.NODE_ENV !== "production") return;
	console.info(`[redis-cache] ${params.route} ${params.status}`, {
		budgetPlanId: params.budgetPlanId,
		key: params.key,
	});
}

export async function getDashboardVersion(budgetPlanId: string): Promise<DashboardVersionPayload | null> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return null;
	return await getJsonCache<DashboardVersionPayload>(getDashboardVersionCacheKey(trimmedBudgetPlanId));
}

export async function bumpDashboardVersion(
	budgetPlanId: string,
	now: Date = new Date(),
): Promise<DashboardVersionPayload | null> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return null;

	const versionPayload: DashboardVersionPayload = {
		version: String(now.getTime()),
		changedAt: now.toISOString(),
	};

	await setJsonCache(
		getDashboardVersionCacheKey(trimmedBudgetPlanId),
		versionPayload,
		DASHBOARD_VERSION_TTL_SECONDS,
	);

	return versionPayload;
}

export async function invalidateDebtSummaryCache(budgetPlanId: string): Promise<void> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return;
	await deleteJsonCacheByPrefix(getDebtSummaryCachePrefix(trimmedBudgetPlanId));
}

export async function invalidateExpenseInsightsCache(budgetPlanId: string): Promise<void> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return;
	await deleteJsonCacheByPrefix(getExpenseInsightsCachePrefix(trimmedBudgetPlanId));
}

export async function invalidateDashboardCache(budgetPlanId: string): Promise<void> {
	const trimmedBudgetPlanId = budgetPlanId.trim();
	if (!trimmedBudgetPlanId) return;
	await Promise.all([
		deleteJsonCacheByPrefix(getDashboardCachePrefix(trimmedBudgetPlanId)),
		invalidateDebtSummaryCache(trimmedBudgetPlanId),
		invalidateExpenseInsightsCache(trimmedBudgetPlanId),
		bumpDashboardVersion(trimmedBudgetPlanId),
	]);
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