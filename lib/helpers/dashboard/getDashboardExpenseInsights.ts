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
}: {
	budgetPlanId: string;
	payDate: number;
	now: Date;
}): Promise<{
	recap: ReturnType<typeof computePreviousMonthRecap>;
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
	const historyOr = historyPairs.map((p) => ({ year: p.year, month: p.monthNum }));

	const [insightRows, historyRows] = await Promise.all([
		prisma.expense.findMany({
			where: {
				budgetPlanId,
				OR: [
					{ year: currentYear, month: currentMonthNum },
					{ year: prevYear, month: prevMonthNum },
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
			},
		}),
		prisma.expense.findMany({
			where: {
				budgetPlanId,
				OR: historyOr,
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
			},
		}),
	]);

	const toExpenseItem = (e: (typeof insightRows)[number]): ExpenseItem => ({
		id: e.id,
		name: e.name,
		amount: toNumber(e.amount),
		paid: e.paid,
		paidAmount: toNumber(e.paidAmount),
		dueDate: e.dueDate ? e.dueDate.toISOString().split("T")[0] : undefined,
	});

	const currentMonthExpenses = insightRows
		.filter((e) => e.year === currentYear && e.month === currentMonthNum)
		.map(toExpenseItem);
	const prevMonthExpenses = insightRows
		.filter((e) => e.year === prevYear && e.month === prevMonthNum)
		.map(toExpenseItem);

	const historyExpenses: DatedExpenseItem[] = historyRows.map((e) => ({
		...toExpenseItem(e),
		year: e.year,
		monthNum: e.month,
	}));

	const forecastPairs = Array.from({ length: 4 }, (_, i) => addMonthsUtc(currentYear, currentMonthNum, i));
	const forecastOr = forecastPairs.map((p) => ({ year: p.year, month: p.monthNum }));

	const [forecastExpenseRows, forecastIncomeRows] = await Promise.all([
		prisma.expense.findMany({
			where: { budgetPlanId, OR: forecastOr },
			select: { amount: true, year: true, month: true },
		}),
		prisma.income.findMany({
			where: { budgetPlanId, OR: forecastOr },
			select: { amount: true, year: true, month: true },
		}),
	]);

	const expenseTotalsByMonth = new Map<string, number>();
	for (const r of forecastExpenseRows) {
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

	const recap = computePreviousMonthRecap(prevMonthExpenses, {
		year: prevYear,
		monthNum: prevMonthNum,
		payDate,
		now,
	});

	const upcomingExpenses = computeUpcomingPayments(currentMonthExpenses, {
		year: currentYear,
		monthNum: currentMonthNum,
		payDate,
		now,
		limit: 12,
	});

	const debtRows = await prisma.debt.findMany({
		where: {
			budgetPlanId,
			paid: false,
			currentBalance: { gt: 0 },
		},
		select: {
			id: true,
			name: true,
			amount: true,
			currentBalance: true,
		},
		orderBy: [{ currentBalance: "desc" }],
	});

	const today = todayUtcDateOnly(now);
	const debtDueIso = isoForPayDate(currentYear, currentMonthNum, payDate);
	const debtDue = parseIsoDateToUtcDateOnly(debtDueIso);
	const debtUpcoming = debtRows
		.map((d) => {
			const amount = toNumber(d.amount);
			if (!(amount > 0)) return null;
			const daysUntilDue = debtDue ? diffDaysUtc(debtDue, today) : 999;
			const status: UpcomingPayment["status"] = "unpaid";
			const item: UpcomingPayment = {
				id: `debt:${d.id}`,
				name: `${d.name} (Debt)`,
				amount,
				paidAmount: 0,
				status,
				dueDate: debtDueIso,
				daysUntilDue,
				urgency: computeUrgency({ status, daysUntilDue }),
			};
			return item;
		})
		.filter((x): x is UpcomingPayment => x != null)
		.sort((a, b) => scoreUpcoming(a) - scoreUpcoming(b) || b.amount - a.amount);

	const monthKey = monthNumberToKey(currentMonthNum);
	const allocationSnapshot = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey);
	const customAllocationsSnapshot = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, {
		year: allocationSnapshot.year,
	});

	const allocationFixedTotal =
		toNumber(allocationSnapshot.monthlyAllowance) +
		toNumber(allocationSnapshot.monthlySavingsContribution) +
		toNumber(allocationSnapshot.monthlyEmergencyContribution) +
		toNumber(allocationSnapshot.monthlyInvestmentContribution);
	const allocationTotal = allocationFixedTotal + toNumber(customAllocationsSnapshot.total);
	const allocDueIso = isoForPayDate(allocationSnapshot.year, currentMonthNum, payDate);
	const allocDue = parseIsoDateToUtcDateOnly(allocDueIso);
	const allocDaysUntil = allocDue ? diffDaysUtc(allocDue, today) : 999;
	const allocationUpcoming: UpcomingPayment | undefined = allocationTotal > 0
		? {
				id: `allocation:${budgetPlanId}:${currentYear}-${currentMonthNum}`,
				name: "Income sacrifice (Allocation)",
				amount: allocationTotal,
				paidAmount: 0,
				status: "unpaid",
				dueDate: allocDueIso,
				daysUntilDue: allocDaysUntil,
				urgency: computeUrgency({ status: "unpaid", daysUntilDue: allocDaysUntil }),
			}
		: undefined;

	const upcoming = selectUpcomingWithMix({
		expenses: upcomingExpenses,
		debts: debtUpcoming,
		allocation: allocationUpcoming,
		limit: 6,
		maxExpenses: 3,
		maxDebts: 2,
	});

	const recapTips = computeRecapTips({
		recap,
		currentMonthExpenses,
		ctx: { year: currentYear, monthNum: currentMonthNum, payDate, now },
		forecasts,
		historyExpenses,
	});

	return { recap, upcoming, recapTips };
}
