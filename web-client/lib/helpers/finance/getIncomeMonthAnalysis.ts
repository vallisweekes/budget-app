import { getAllIncome } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";
import type { MonthKey } from "@/types";

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number(value);
	if (typeof value === "object") {
		const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
		if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
		if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
	}
	return Number(value);
}

type Params = {
	budgetPlanId: string;
	year: number;
	month: number;
	payFrequency?: PayFrequency | null | undefined;
};

function normalizeIncomeKey(name: unknown): string {
	return String(name ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function clampDayUtc(year: number, monthIndex0: number, day: number): Date {
	const maxDay = daysInMonthUtc(year, monthIndex0);
	const clamped = Math.max(1, Math.min(maxDay, Math.floor(day)));
	return new Date(Date.UTC(year, monthIndex0, clamped));
}

function utcDateOnly(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function resolveEffectiveExpenseDueDateUtc(expense: { dueDate: Date | null; year: number; month: number }, payDate: number): Date | null {
	if (expense.dueDate) return utcDateOnly(expense.dueDate);
	if (!Number.isFinite(expense.year) || !Number.isFinite(expense.month)) return null;
	if (expense.month < 1 || expense.month > 12) return null;
	const safePayDate = Number.isFinite(payDate) ? Math.max(1, Math.floor(payDate)) : 27;
	return clampDayUtc(expense.year, expense.month - 1, safePayDate);
}

export async function getIncomeMonthAnalysis({ budgetPlanId, year, month, payFrequency }: Params) {
	const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;
	const prevMonthKey = monthNumberToKey(prevMonth as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
	const cadence = normalizePayFrequency(payFrequency);

	const [incomeByMonth, prevIncomeByMonth, plan, allocationSnapshot, customAllocationsSnapshot, debtPlan] = await Promise.all([
		getAllIncome(budgetPlanId, year),
		prevYear === year ? Promise.resolve(null) : getAllIncome(budgetPlanId, prevYear),
		prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { payDate: true } }),
		getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyDebtPlan({ budgetPlanId, year, month }),
	]);

	const endItems = incomeByMonth[monthKey] ?? [];
	const startItems = cadence === "monthly"
		? ((prevYear === year
			? (incomeByMonth[prevMonthKey] ?? [])
			: (prevIncomeByMonth?.[prevMonthKey] ?? [])))
		: [];

	const endKeys = new Set(endItems.map((i) => normalizeIncomeKey(i.name)).filter(Boolean));
	const extraStartItems = startItems.filter((i) => {
		const key = normalizeIncomeKey(i.name);
		return Boolean(key) && !endKeys.has(key);
	});

	const incomeItems = cadence === "monthly" ? [...endItems, ...extraStartItems] : endItems;
	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

	let plannedExpenses = 0;
	let paidExpenses = 0;
	if (cadence === "monthly") {
		const payDate = Number(plan?.payDate ?? 27);
		const window = buildPayPeriodFromMonthAnchor({
			anchorYear: year,
			anchorMonth: month,
			payDate,
			payFrequency: cadence,
		});

		const candidates = await prisma.expense.findMany({
			where: {
				budgetPlanId,
				isAllocation: false,
				isMovedToDebt: false,
				OR: [
					{ year, month },
					{ year: prevYear, month: prevMonth },
				],
			},
			select: {
				amount: true,
				paidAmount: true,
				paid: true,
				dueDate: true,
				year: true,
				month: true,
			},
		});

		const startMs = utcDateOnly(window.start).getTime();
		const endMs = utcDateOnly(window.end).getTime();
		for (const exp of candidates) {
			const due = resolveEffectiveExpenseDueDateUtc(
				{ dueDate: exp.dueDate, year: exp.year, month: exp.month },
				payDate,
			);
			if (!due) continue;
			const dueMs = due.getTime();
			if (dueMs < startMs || dueMs > endMs) continue;
			const amount = decimalToNumber(exp.amount);
			if (!(amount > 0)) continue;
			plannedExpenses += amount;
			const rawPaid = decimalToNumber(exp.paidAmount);
			const paidContribution = exp.paid
				? amount
				: Math.max(0, Math.min(amount, rawPaid));
			paidExpenses += paidContribution;
		}
	} else {
		const expenseAgg = await prisma.expense.aggregate({
			where: { budgetPlanId, year, month, isAllocation: false, isMovedToDebt: false },
			_sum: { amount: true, paidAmount: true },
		});
		plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
		paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);
	}

	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
	const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
	const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

	const plannedDebtPayments = debtPlan.plannedDebtPayments;
	const paidDebtPaymentsFromIncome = debtPlan.paidDebtPaymentsFromIncome;

	const plannedBills = plannedExpenses + plannedDebtPayments;
	const paidBillsSoFar = paidExpenses + paidDebtPaymentsFromIncome;
	const remainingBills = Math.max(0, plannedBills - paidBillsSoFar);
	const moneyLeftAfterPlan = grossIncome - plannedBills - plannedSetAside;
	const incomeLeftRightNow = grossIncome - paidBillsSoFar - plannedSetAside;
	const moneyOutTotal = plannedBills + plannedSetAside;

	return {
		month,
		year,
		monthKey,
		incomeItems,
		grossIncome,
		sourceCount: incomeItems.length,
		plannedExpenses,
		paidExpenses,
		plannedDebtPayments,
		paidDebtPaymentsFromIncome,
		monthlyAllowance,
		incomeSacrifice: plannedSetAside,
		setAsideBreakdown: {
			savings: savingsContribution,
			emergency: emergencyContribution,
			investments: investmentContribution,
			custom: customSetAsideTotal,
			fromAllocations: plannedSetAsideFromAllocations,
			customCount: customAllocationsSnapshot.items?.length ?? 0,
			isAllowanceOverride: !!allocationSnapshot.isOverride,
		},
		plannedBills,
		paidBillsSoFar,
		remainingBills,
		moneyLeftAfterPlan,
		incomeLeftRightNow,
		moneyOutTotal,
		isOnPlan: moneyLeftAfterPlan >= 0,
	};
}
