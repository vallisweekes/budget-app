import { prisma } from "@/lib/prisma";
import type { ExpenseItem } from "@/types";
import {
	computePreviousMonthRecap,
	computeUpcomingPayments,
	computeRecapTips,
	type DatedExpenseItem,
} from "@/lib/expenses/insights";
import { addMonthsUtc, toNumber } from "@/lib/helpers/dashboard/utils";

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

	const upcoming = computeUpcomingPayments(currentMonthExpenses, {
		year: currentYear,
		monthNum: currentMonthNum,
		payDate,
		now,
		limit: 6,
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
