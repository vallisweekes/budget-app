import { prisma } from "@/lib/prisma";
import type { ExpenseItem } from "@/types";
import {
	computePreviousMonthRecap,
	computeUpcomingPayments,
	computeRecapTips,
	type ExpenseUrgency,
	type UpcomingPayment,
	type DatedExpenseItem,
} from "@/lib/expenses/insights";
import { addMonthsUtc, toNumber } from "@/lib/helpers/dashboard/utils";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function isoForPayDate(year: number, monthNum: number, payDate: number): string {
	const monthIndex0 = monthNum - 1;
	const maxDay = daysInMonthUtc(year, monthIndex0);
	const day = Math.max(1, Math.min(maxDay, Math.floor(payDate)));
	return `${year}-${pad2(monthNum)}-${pad2(day)}`;
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

function computeUrgency(args: { status: UpcomingPayment["status"]; daysUntilDue: number }): ExpenseUrgency {
	if (args.status === "paid") return "later";
	if (args.daysUntilDue < 0) return "overdue";
	if (args.daysUntilDue === 0) return "today";
	if (args.daysUntilDue <= 7) return "soon";
	return "later";
}

function scoreUpcoming(u: UpcomingPayment): number {
	if (u.status === "paid") return 10000 + u.daysUntilDue;
	switch (u.urgency) {
		case "overdue":
			return -1000 + u.daysUntilDue;
		case "today":
			return -500;
		case "soon":
			return u.daysUntilDue;
		default:
			return 100 + u.daysUntilDue;
	}
}

function selectUpcomingWithMix(args: {
	expenses: UpcomingPayment[];
	debts: UpcomingPayment[];
	allocation?: UpcomingPayment;
	limit: number;
	maxExpenses: number;
	maxDebts: number;
}): UpcomingPayment[] {
	const selected: UpcomingPayment[] = [];

	const expenses = args.expenses.slice();
	const debts = args.debts.slice();
	const allocation = args.allocation ? [args.allocation] : [];

	selected.push(...expenses.slice(0, Math.max(0, args.maxExpenses)));
	selected.push(...debts.slice(0, Math.max(0, args.maxDebts)));
	selected.push(...allocation.slice(0, 1));

	if (selected.length < args.limit) {
		const remaining = args.limit - selected.length;
		selected.push(...expenses.slice(args.maxExpenses, args.maxExpenses + remaining));
	}

	if (selected.length < args.limit) {
		const remaining = args.limit - selected.length;
		selected.push(...debts.slice(args.maxDebts, args.maxDebts + remaining));
	}

	return selected
		.sort((a, b) => scoreUpcoming(a) - scoreUpcoming(b) || b.amount - a.amount)
		.slice(0, Math.max(0, args.limit));
}

export async function getDashboardExpenseInsights({
	budgetPlanId,
	payDate,
	now,
	userId,
}: {
	budgetPlanId: string;
	payDate: number;
	now: Date;
	userId?: string | null;
}): Promise<{
	recap: ReturnType<typeof computePreviousMonthRecap> | null;
	upcoming: ReturnType<typeof computeUpcomingPayments>;
	recapTips: ReturnType<typeof computeRecapTips>;
}> {
	const currentYear = now.getFullYear();
	const currentMonthNum = now.getMonth() + 1;
	const prev = new Date(now);
	prev.setMonth(prev.getMonth() - 1);
	const prevYear = prev.getFullYear();
	const prevMonthNum = prev.getMonth() + 1;

	const historyPairs = Array.from({ length: 6 }, (_, i) => addMonthsUtc(currentYear, currentMonthNum, -i));
	// Upcoming payments should not jump ahead into next month just because the pay-date has passed.
	// Base month is the current calendar month; we only advance to next month if the current month is fully covered.
	const basePay = {
		year: currentYear,
		monthNum: currentMonthNum,
		dueIso: isoForPayDate(currentYear, currentMonthNum, payDate),
		due: parseIsoDateToUtcDateOnly(isoForPayDate(currentYear, currentMonthNum, payDate)),
	};
	const baseMonthPairs = Array.from({ length: 3 }, (_, i) => addMonthsUtc(basePay.year, basePay.monthNum, i));
	const forecastPairs = Array.from({ length: 4 }, (_, i) => addMonthsUtc(currentYear, currentMonthNum, i));

	const expenseWindowPairs = Array.from(
		new Map(
			[...historyPairs, ...baseMonthPairs, ...forecastPairs].map((p) => [`${p.year}-${p.monthNum}`, p])
		).values()
	);
	const expenseWindowOr = expenseWindowPairs.map((p) => ({ year: p.year, month: p.monthNum }));
	const forecastOr = forecastPairs.map((p) => ({ year: p.year, month: p.monthNum }));

	const [expenseWindowRows, forecastIncomeRows, userRow] = await Promise.all([
		prisma.expense.findMany({
			where: {
				budgetPlanId,
				OR: expenseWindowOr,
			},
			select: {
				id: true,
				name: true,
				logoUrl: true,
				amount: true,
				paid: true,
				paidAmount: true,
				dueDate: true,
				year: true,
				month: true,
			},
		}),
		prisma.income.findMany({
			where: { budgetPlanId, OR: forecastOr },
			select: { amount: true, year: true, month: true },
		}),
		userId
			? prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
			: Promise.resolve(null),
	]);

	const toExpenseItem = (e: (typeof expenseWindowRows)[number]): ExpenseItem => ({
		id: e.id,
		name: e.name,
		logoUrl: (e.logoUrl ?? resolveExpenseLogo(e.name).logoUrl) ?? undefined,
		amount: toNumber(e.amount),
		paid: e.paid,
		paidAmount: toNumber(e.paidAmount),
		dueDate: e.dueDate ? e.dueDate.toISOString().split("T")[0] : undefined,
	});
	const yearMonthKey = (year: number, monthNum: number) => `${year}-${monthNum}`;
	const historyKeySet = new Set(historyPairs.map((p) => yearMonthKey(p.year, p.monthNum)));
	const forecastKeySet = new Set(forecastPairs.map((p) => yearMonthKey(p.year, p.monthNum)));

	const expenseRowsByMonth = expenseWindowRows.reduce(
		(acc, row) => {
			const key = yearMonthKey(row.year, row.month);
			if (!acc[key]) acc[key] = [];
			acc[key].push(row);
			return acc;
		},
		{} as Record<string, typeof expenseWindowRows>
	);

	const currentMonthKey = yearMonthKey(currentYear, currentMonthNum);
	const prevMonthKey = yearMonthKey(prevYear, prevMonthNum);
	const currentMonthExpenses = (expenseRowsByMonth[currentMonthKey] ?? []).map(toExpenseItem);
	const prevMonthExpenses = (expenseRowsByMonth[prevMonthKey] ?? []).map(toExpenseItem);

	const historyExpenses: DatedExpenseItem[] = expenseWindowRows
		.filter((e) => historyKeySet.has(yearMonthKey(e.year, e.month)))
		.map((e) => ({
			...toExpenseItem(e),
			year: e.year,
			monthNum: e.month,
		}));

	const expenseTotalsByMonth = new Map<string, number>();
	for (const r of expenseWindowRows) {
		if (!forecastKeySet.has(yearMonthKey(r.year, r.month))) continue;
		const key = `${r.year}-${r.month}`;
		expenseTotalsByMonth.set(key, (expenseTotalsByMonth.get(key) ?? 0) + toNumber(r.amount));
	}

	const incomeTotalsByMonth = new Map<string, number>();
	for (const r of forecastIncomeRows) {
		const key = `${r.year}-${r.month}`;
		incomeTotalsByMonth.set(key, (incomeTotalsByMonth.get(key) ?? 0) + toNumber(r.amount));
	}

	const forecasts = forecastPairs.map((p) => {
		const key = `${p.year}-${p.monthNum}`;
		return {
			year: p.year,
			monthNum: p.monthNum,
			incomeTotal: incomeTotalsByMonth.get(key) ?? 0,
			billsTotal: expenseTotalsByMonth.get(key) ?? 0,
		};
	});

	const userCreatedAt = userRow?.createdAt ?? null;
	const userStartYear = userCreatedAt ? userCreatedAt.getUTCFullYear() : null;
	const userStartMonthIndex = userCreatedAt ? userCreatedAt.getUTCMonth() : null;
	const prevMonthIndex0 = prevMonthNum - 1;
	const prevMonthBeforeSignup =
		userStartYear != null &&
		userStartMonthIndex != null &&
		(prevYear < userStartYear || (prevYear === userStartYear && prevMonthIndex0 < userStartMonthIndex));

	const shouldSuppressRecap = prevMonthBeforeSignup && prevMonthExpenses.length === 0;
	const recap = shouldSuppressRecap
		? null
		: computePreviousMonthRecap(prevMonthExpenses, {
			year: prevYear,
			monthNum: prevMonthNum,
			payDate,
			now,
		});

	const today = todayUtcDateOnly(now);

	const baseDueIso = isoForPayDate(basePay.year, basePay.monthNum, payDate);
	const baseDue = parseIsoDateToUtcDateOnly(baseDueIso);
	let selectedBase = { year: basePay.year, monthNum: basePay.monthNum, dueIso: baseDueIso, due: baseDue };

	const baseMonthExpenses = (expenseRowsByMonth[yearMonthKey(selectedBase.year, selectedBase.monthNum)] ?? []).map(toExpenseItem);
	const baseMonthUpcomingExpenses = computeUpcomingPayments(baseMonthExpenses, {
		year: selectedBase.year,
		monthNum: selectedBase.monthNum,
		payDate,
		now,
		limit: 50,
	}).filter((u) => u.status !== "paid");

	// If there are no unpaid upcoming expenses for the base month, show next month instead.
	if (baseMonthUpcomingExpenses.length === 0) {
		const next = addMonthsUtc(selectedBase.year, selectedBase.monthNum, 1);
		const nextDueIso = isoForPayDate(next.year, next.monthNum, payDate);
		selectedBase = { year: next.year, monthNum: next.monthNum, dueIso: nextDueIso, due: parseIsoDateToUtcDateOnly(nextDueIso) };
	}

	// Upcoming expenses are ordered by *actual effective due date*, regardless of which month the record lives under.
	// This fixes cases where an expense is saved under a later month but has a nearer due date.
	const upcomingExpenses = expenseWindowPairs
		.flatMap((p) => {
			const key = yearMonthKey(p.year, p.monthNum);
			const rows = expenseRowsByMonth[key] ?? [];
			if (rows.length === 0) return [];
			return computeUpcomingPayments(rows.map(toExpenseItem), {
				year: p.year,
				monthNum: p.monthNum,
				payDate,
				now,
				limit: 200,
			});
		})
		.filter((u) => u.status !== "paid")
		.sort((a, b) => scoreUpcoming(a) - scoreUpcoming(b) || b.amount - a.amount);

	const monthKey = monthNumberToKey(selectedBase.monthNum);
	const allocationSnapshot = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey);
	const customAllocationsSnapshot = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, {
		year: allocationSnapshot.year,
	});

	const allocationParts: Array<{ name: string; amount: number }> = [];
	const allowanceAmt = toNumber(allocationSnapshot.monthlyAllowance);
	const savingsAmt = toNumber(allocationSnapshot.monthlySavingsContribution);
	const emergencyAmt = toNumber(allocationSnapshot.monthlyEmergencyContribution);
	const investmentAmt = toNumber(allocationSnapshot.monthlyInvestmentContribution);
	if (allowanceAmt > 0) allocationParts.push({ name: "Monthly allowance", amount: allowanceAmt });
	if (savingsAmt > 0) allocationParts.push({ name: "Savings contribution", amount: savingsAmt });
	if (emergencyAmt > 0) allocationParts.push({ name: "Emergency fund", amount: emergencyAmt });
	if (investmentAmt > 0) allocationParts.push({ name: "Investments", amount: investmentAmt });
	for (const item of customAllocationsSnapshot.items ?? []) {
		const amt = toNumber(item.amount);
		const label = String(item.name ?? "").trim();
		if (amt > 0 && label) allocationParts.push({ name: label, amount: amt });
	}

	const allocationFixedTotal = allowanceAmt + savingsAmt + emergencyAmt + investmentAmt;
	const allocationTotal = allocationFixedTotal + toNumber(customAllocationsSnapshot.total);
	const allocDueIso = isoForPayDate(allocationSnapshot.year, selectedBase.monthNum, payDate);
	const allocDue = parseIsoDateToUtcDateOnly(allocDueIso);
	const allocDaysUntil = allocDue ? diffDaysUtc(allocDue, today) : 999;
	const allocationUpcomingName = (() => {
		if (allocationParts.length === 1) return allocationParts[0].name;
		if (allocationParts.length > 1) return "Income sacrifice";
		return "Income sacrifice";
	})();
	const allocationUpcoming: UpcomingPayment | undefined = allocationTotal > 0
		? {
				id: `allocation:${budgetPlanId}:${currentYear}-${currentMonthNum}`,
				kind: "allocation",
				name: allocationUpcomingName,
				amount: allocationTotal,
				paidAmount: 0,
				status: "unpaid",
				dueDate: allocDueIso,
				daysUntilDue: allocDaysUntil,
				urgency: computeUrgency({ status: "unpaid", daysUntilDue: allocDaysUntil }),
			}
		: undefined;

	// Keep the expense insights list debt-free.
	// Debts are surfaced separately via debt summary pipelines (mobile `upcomingDebts`, debt screens).
	const upcoming = selectUpcomingWithMix({
		expenses: upcomingExpenses,
		debts: [],
		allocation: allocationUpcoming,
		limit: 6,
		maxExpenses: 6,
		maxDebts: 0,
	});

	const recapTips = recap
		? computeRecapTips({
			recap,
			currentMonthExpenses,
			ctx: { year: currentYear, monthNum: currentMonthNum, payDate, now },
			forecasts,
			historyExpenses,
		})
		: [];

	return { recap, upcoming, recapTips };
}
