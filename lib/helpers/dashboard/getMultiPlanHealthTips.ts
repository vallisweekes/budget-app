import { prisma } from "@/lib/prisma";
import type { ExpenseItem } from "@/types";
import {
	getPaymentStatus,
	resolveEffectiveDueDateIso,
	type RecapTip,
} from "@/lib/expenses/insights";
import { formatCurrency } from "@/lib/helpers/money";

function titleCaseIfAllCaps(value: string): string {
	const s = String(value ?? "").trim();
	if (!s) return s;
	if (!/[A-Za-z]/.test(s)) return s;
	if (s !== s.toUpperCase()) return s;
	return s
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

function normalizeLabel(value: string): string {
	let s = String(value ?? "").trim();
	if (!s) return "";
	// Remove trailing auto-appended date tokens like "(2026-01)", "(2026-01 2026)", or "(2026-01 2026-01)".
	s = s.replace(/\s*\((\d{4}-\d{2})(?:\s+\d{4}(?:-\d{2})?)?\)\s*$/u, "").trim();
	return titleCaseIfAllCaps(s);
}

function formatShortDate(dt: Date): string {
	return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(dt);
}

function monthsUntil(fromYear: number, fromMonth: number, toYear: number, toMonth: number): number {
	return Math.max(0, (toYear - fromYear) * 12 + (toMonth - fromMonth));
}

function parseIsoDateToUtcDateOnly(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m, d] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(Date.UTC(y, m - 1, d));
}

function todayUtcDateOnly(now: Date = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function diffDaysUtc(a: Date, b: Date): number {
	const ms = 24 * 60 * 60 * 1000;
	return Math.round((a.getTime() - b.getTime()) / ms);
}

function toNumber(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function monthLabel(year: number, monthNum: number): string {
	const dt = new Date(Date.UTC(year, Math.max(0, monthNum - 1), 1));
	return dt.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function getMultiPlanHealthTips(args: {
	planIds: string[];
	now: Date;
	payDate: number;
	largestExpensesByPlan?: Record<string, { year: number; month: number; items: Array<{ id: string; name: string; amount: number }> }>;
}): Promise<RecapTip[]> {
	const tips: RecapTip[] = [];
	const planIds = Array.isArray(args.planIds) ? args.planIds.filter(Boolean) : [];
	if (planIds.length === 0) return tips;

	const now = args.now;
	const today = todayUtcDateOnly(now);
	const currentYear = now.getFullYear();
	const currentMonthNum = now.getMonth() + 1;

	const plans = await prisma.budgetPlan.findMany({
		where: { id: { in: planIds } },
		select: { id: true, kind: true, name: true },
	});

	const hasOtherPlans = plans.length > 1;

	// 1) Cross-plan debt pressure (DB debts only).
	const debtAgg = await prisma.debt.aggregate({
		where: {
			budgetPlanId: { in: planIds },
			paid: false,
			currentBalance: { gt: 0 },
		},
		_sum: { currentBalance: true },
	});
	const totalDebtBalance = toNumber(debtAgg._sum.currentBalance);
	if (totalDebtBalance > 0 && hasOtherPlans) {
		tips.push({
			title: "Total debt across plans",
			detail: `Across all your plans you have about £${Math.round(totalDebtBalance).toLocaleString("en-GB")} outstanding. Consider prioritising the highest-interest / highest-balance debt first.`,
		});
	}

	// 2) Bills due soon across all plans (next ~3 months window).
	const upcomingExpenseRows = await prisma.expense.findMany({
		where: {
			budgetPlanId: { in: planIds },
			amount: { gt: 0 },
			OR: [
				{ year: { gt: currentYear } },
				{ year: currentYear, month: { gte: currentMonthNum } },
			],
		},
		select: {
			id: true,
			name: true,
			amount: true,
			paid: true,
			paidAmount: true,
			dueDate: true,
			year: true,
			month: true,
			budgetPlanId: true,
		},
		take: 600,
		orderBy: [{ year: "asc" }, { month: "asc" }],
	});

	type UpcomingLike = {
		id: string;
		name: string;
		remaining: number;
		daysUntilDue: number;
		planId: string;
	};

	const upcoming: UpcomingLike[] = [];
	for (const row of upcomingExpenseRows) {
		const item: ExpenseItem = {
			id: row.id,
			name: row.name,
			amount: toNumber(row.amount),
			paid: row.paid,
			paidAmount: toNumber(row.paidAmount),
			dueDate: row.dueDate ? row.dueDate.toISOString().split("T")[0] : undefined,
		};
		const status = getPaymentStatus(item);
		if (status === "paid") continue;
		const dueIso = resolveEffectiveDueDateIso(item, { year: row.year, monthNum: row.month, payDate: args.payDate });
		if (!dueIso) continue;
		const due = parseIsoDateToUtcDateOnly(dueIso);
		if (!due) continue;
		const remaining = Math.max(0, toNumber(item.amount) - toNumber(item.paidAmount));
		if (!(remaining > 0)) continue;
		const daysUntilDue = diffDaysUtc(due, today);

		// Keep the list bounded to near-term due dates (avoids pulling far-future noise).
		if (daysUntilDue > 120) continue;

		upcoming.push({
			id: row.id,
			name: row.name,
			remaining,
			daysUntilDue,
			planId: row.budgetPlanId,
		});
	}

	const dueIn7 = upcoming.filter((u) => u.daysUntilDue <= 7);
	const dueIn30 = upcoming.filter((u) => u.daysUntilDue <= 30);
	const sum7 = dueIn7.reduce((s, u) => s + u.remaining, 0);
	const sum30 = dueIn30.reduce((s, u) => s + u.remaining, 0);

	if (hasOtherPlans && (dueIn7.length > 0 || dueIn30.length > 0)) {
		if (dueIn7.length > 0) {
			tips.push({
				title: "Bills due within 7 days",
				detail: `Across all plans you have ${dueIn7.length} bill(s) due within 7 days (≈ £${Math.round(sum7).toLocaleString("en-GB")} remaining).`,
			});
		} else {
			tips.push({
				title: "Bills due soon",
				detail: `Across all plans you have ${dueIn30.length} bill(s) due within 30 days (≈ £${Math.round(sum30).toLocaleString("en-GB")} remaining).`,
			});
		}
	}

	// 3) Event plan visibility: if a plan has no expenses this month, point to the next month with expenses (even across years).
	const largestByPlan = args.largestExpensesByPlan ?? {};
	if (hasOtherPlans) {
		for (const p of plans) {
			const key = String(p.kind ?? "").toLowerCase();
			if (key !== "holiday" && key !== "carnival") continue;
			const next = largestByPlan[p.id];
			if (!next) continue;
			const isCurrent = next.year === currentYear && next.month === currentMonthNum;
			if (isCurrent) continue;

			const since = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
			const [recentAdds, lastTouched, recentPayments] = await Promise.all([
				prisma.expense.count({ where: { budgetPlanId: p.id, createdAt: { gte: since } } }),
				prisma.expense.findFirst({
					where: { budgetPlanId: p.id },
					select: { name: true, updatedAt: true },
					orderBy: { updatedAt: "desc" },
				}),
				prisma.expensePayment.count({
					where: { expense: { budgetPlanId: p.id }, createdAt: { gte: since } },
				}),
			]);

			const nextItems = Array.isArray(next.items) ? next.items : [];
			const nextTotal = nextItems.reduce((sum, it) => sum + toNumber(it.amount), 0);
			const largest = nextItems.reduce<{ name: string; amount: number } | null>((best, it) => {
				const amt = toNumber(it.amount);
				if (!(amt > 0)) return best;
				if (!best || amt > best.amount) return { name: it.name, amount: amt };
				return best;
			}, null);

			const monthGap = monthsUntil(currentYear, currentMonthNum, next.year, next.month);
			const savingSuggestion = monthGap >= 2 && nextTotal > 0 ? formatCurrency(nextTotal / monthGap) : null;
			const activityParts: string[] = [];
			if (recentAdds > 0) activityParts.push(`you added ${recentAdds} item(s)`);
			if (recentPayments > 0) activityParts.push(`you recorded ${recentPayments} payment(s)`);
			const activityLine = activityParts.length ? `In the last 3 weeks, ${activityParts.join(" and ")} on this plan.` : "";
			const lastTouchedLine = lastTouched?.updatedAt
				? `Last update: ${normalizeLabel(lastTouched.name)} on ${formatShortDate(lastTouched.updatedAt)}.`
				: "";
			const nextSummary = nextTotal > 0
				? `Next planned expenses are in ${monthLabel(next.year, next.month)} (≈ ${formatCurrency(nextTotal)} total).`
				: `Next planned expenses are in ${monthLabel(next.year, next.month)}.`;
			const largestLine = largest ? `Biggest planned item: ${normalizeLabel(largest.name)} (${formatCurrency(largest.amount)}).` : "";
			const saveLine = savingSuggestion ? `If you want to be ready, setting aside about ${savingSuggestion} per month until then will cover it.` : "";

			const detail = [
				`No expenses for this plan in ${monthLabel(currentYear, currentMonthNum)} yet.`,
				nextSummary,
				largestLine,
				activityLine,
				lastTouchedLine,
				saveLine,
			]
				.map((s) => s.trim())
				.filter(Boolean)
				.join(" ");
			tips.push({
				title: `${p.name || (key === "holiday" ? "Holiday" : "Carnival")}: next expenses`,
				detail,
			});
		}
	}

	return tips;
}
