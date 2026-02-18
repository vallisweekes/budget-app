import { prisma } from "@/lib/prisma";
import type { ExpenseItem } from "@/types";
import {
	getPaymentStatus,
	resolveEffectiveDueDateIso,
	type RecapTip,
} from "@/lib/expenses/insights";

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
			tips.push({
				title: `${p.name || (key === "holiday" ? "Holiday" : "Carnival")}: next expenses`,
				detail: `No expenses in the current month. Next expenses show in ${monthLabel(next.year, next.month)} for this plan.`,
			});
		}
	}

	return tips;
}
