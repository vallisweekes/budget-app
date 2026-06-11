import { getAllIncome, getIncomeForAnchorMonth } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyDebtPlan, getMonthlyPlannedDebtPaymentsOnly } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import { getPayPeriodExpenses, includeInPlannedExpenseTotals } from "@/lib/helpers/finance/payPeriodExpenses";
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
	mode?: "full" | "home_core";
};

type ExpenseTooltipPreviewItem = {
	expenseId: string;
	expenseName: string;
	planId: string;
	planName: string;
	amount: number;
};

type ExpenseTooltipPreview = {
	items: ExpenseTooltipPreviewItem[];
	remainingCount: number;
};

function buildExpenseTooltipPreview(
	expenses: Array<{ id: string; name: string; amount: unknown; budgetPlanId: string }>,
	planNamesById: Map<string, string>
): ExpenseTooltipPreview {
	const sortedExpenses = [...expenses].sort((left, right) => {
		const amountDifference = decimalToNumber(right.amount) - decimalToNumber(left.amount);
		if (amountDifference !== 0) return amountDifference;
		return String(left.name ?? "").localeCompare(String(right.name ?? ""));
	});
	const previewItems = sortedExpenses.slice(0, 2).map((expense) => ({
		expenseId: String(expense.id ?? "").trim(),
		expenseName: String(expense.name ?? "Expense").trim() || "Expense",
		planId: expense.budgetPlanId,
		planName: planNamesById.get(expense.budgetPlanId) ?? "Budget plan",
		amount: decimalToNumber(expense.amount),
	}));

	return {
		items: previewItems,
		remainingCount: Math.max(0, sortedExpenses.length - previewItems.length),
	};
}

async function getPeriodExpenseSnapshot(params: {
	budgetPlanIds: string[];
	selectedBudgetPlanId: string;
	planNamesById: Map<string, string>;
	windowStart: Date;
	windowEnd: Date;
	payDate: number;
}): Promise<{
	plannedExpenses: number;
	paidExpenses: number;
	expenseIds: string[];
	loggedExpenseIds: string[];
	selectedPlanExpenses: number;
	additionalPlansExpenses: number;
	selectedPlanPreview: ExpenseTooltipPreview;
	additionalPlansPreview: ExpenseTooltipPreview;
}> {
	const snapshots = await Promise.all(
		params.budgetPlanIds.map((budgetPlanId) =>
			getPayPeriodExpenses({
				budgetPlanId,
				windowStart: params.windowStart,
				windowEnd: params.windowEnd,
				payDate: params.payDate,
				includeLoggedExpensesInResults: true,
			})
		)
	);
	const perPlanSnapshots = snapshots.map((expenses, index) => ({
		budgetPlanId: params.budgetPlanIds[index] ?? "",
		expenses,
	}));
	const allPeriodExpenses = perPlanSnapshots.flatMap((snapshot) =>
		snapshot.expenses.map((expense) => ({
			budgetPlanId: snapshot.budgetPlanId,
			id: String(expense.id ?? "").trim(),
			name: String(expense.name ?? "Expense").trim() || "Expense",
			amount: expense.amount,
			paidAmount: expense.paidAmount,
			isExtraLoggedExpense: Boolean(expense.isExtraLoggedExpense ?? false),
		}))
	);
	const plannedPeriodExpenses = allPeriodExpenses.filter((expense) => includeInPlannedExpenseTotals(expense));
	const loggedPeriodExpenses = allPeriodExpenses.filter((expense) => expense.isExtraLoggedExpense);
	const selectedPlanExpenseRows = allPeriodExpenses.filter((expense) => expense.budgetPlanId === params.selectedBudgetPlanId);
	const additionalPlanExpenseRows = allPeriodExpenses.filter((expense) => expense.budgetPlanId !== params.selectedBudgetPlanId);
	const selectedPlanExpenses = selectedPlanExpenseRows
		.filter((expense) => includeInPlannedExpenseTotals(expense))
		.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
	const additionalPlansExpenses = additionalPlanExpenseRows
		.filter((expense) => includeInPlannedExpenseTotals(expense))
		.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
	return {
		plannedExpenses: plannedPeriodExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
		paidExpenses: plannedPeriodExpenses.reduce((sum, expense) => sum + Number(expense.paidAmount ?? 0), 0),
		expenseIds: plannedPeriodExpenses.map((expense) => expense.id).filter(Boolean),
		loggedExpenseIds: loggedPeriodExpenses.map((expense) => expense.id).filter(Boolean),
		selectedPlanExpenses,
		additionalPlansExpenses,
		selectedPlanPreview: buildExpenseTooltipPreview(selectedPlanExpenseRows.filter((expense) => includeInPlannedExpenseTotals(expense)), params.planNamesById),
		additionalPlansPreview: buildExpenseTooltipPreview(additionalPlanExpenseRows.filter((expense) => includeInPlannedExpenseTotals(expense)), params.planNamesById),
	};
}

export async function getIncomeMonthAnalysis({ budgetPlanId, year, month, payFrequency, mode = "full" }: Params) {
	const isHomeCoreMode = mode === "home_core";
	const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
	const cadence = normalizePayFrequency(payFrequency);

	// Fetch payDate first so we can compute the pay-period window for period-based queries.
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true, kind: true, eventDate: true, userId: true, name: true },
	});
	const payDate = Number(plan?.payDate ?? 27);
	const { expensePlanIds, expensePlanNamesById } = await (async () => {
		if (isHomeCoreMode) {
			return {
				expensePlanIds: [budgetPlanId],
				expensePlanNamesById: new Map([[budgetPlanId, String(plan?.name ?? "My Budget").trim() || "My Budget"]]),
			};
		}

		if (!plan?.userId || plan.kind !== "personal") {
			return {
				expensePlanIds: [budgetPlanId],
				expensePlanNamesById: new Map([[budgetPlanId, String(plan?.name ?? "My Budget").trim() || "My Budget"]]),
			};
		}

		const ownedPlans = await prisma.budgetPlan.findMany({
			where: { userId: plan.userId },
			select: { id: true, name: true },
		});
		const ids = ownedPlans.map((ownedPlan) => ownedPlan.id).filter(Boolean);
		return {
			expensePlanIds: ids.length > 0 ? ids : [budgetPlanId],
			expensePlanNamesById: new Map(
				ownedPlans.map((ownedPlan) => [
					ownedPlan.id,
					String(ownedPlan.name ?? "My Budget").trim() || "My Budget",
				])
			),
		};
	})();
	const eventScope = (() => {
		const kind = String(plan?.kind ?? "");
		const eventDate = plan?.eventDate instanceof Date ? plan.eventDate : null;
		if (!eventDate) return null;
		if (kind !== "holiday" && kind !== "carnival") return null;
		return {
			kind,
			eventYear: eventDate.getFullYear(),
			eventMonth: eventDate.getMonth() + 1,
		};
	})();
	const periodWindow = cadence === "monthly"
		? buildPayPeriodFromMonthAnchor({ anchorYear: year, anchorMonth: month, payDate, payFrequency: cadence })
		: null;
	const periodKey = periodWindow ? getPeriodKey(periodWindow.start, payDate) : undefined;
	const expenseSnapshotPromise = cadence === "monthly" && periodWindow && !isHomeCoreMode
		? getPeriodExpenseSnapshot({
			budgetPlanIds: expensePlanIds,
			selectedBudgetPlanId: budgetPlanId,
			planNamesById: expensePlanNamesById,
			windowStart: periodWindow.start,
			windowEnd: periodWindow.end,
			payDate,
		})
		: Promise.resolve(null);

	const [incomeByMonth, periodIncomeItems, allocationSnapshot, customAllocationsSnapshot, debtPlan, plannedDebtOnly, expenseSnapshot] = await Promise.all([
		cadence === "monthly" ? Promise.resolve(null) : getAllIncome(budgetPlanId, year),
		cadence === "monthly"
			? getIncomeForAnchorMonth({ budgetPlanId, year, month, payDate, payFrequency: cadence, scope: eventScope })
			: Promise.resolve(null),
		getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year, fallbackToPlanDefaults: false }),
		getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year, fallbackToDefinitionDefaults: false }),
		isHomeCoreMode
			? Promise.resolve(null)
			: getMonthlyDebtPlan({
				budgetPlanId,
				year,
				month,
				periodKey,
				periodStart: periodWindow?.start,
				periodEnd: periodWindow?.end,
			}),
		isHomeCoreMode
			? getMonthlyPlannedDebtPaymentsOnly({
				budgetPlanId,
				year,
				month,
				periodKey,
				periodStart: periodWindow?.start,
				periodEnd: periodWindow?.end,
			})
			: Promise.resolve(null),
		expenseSnapshotPromise,
	]);

	const incomeItems = cadence === "monthly"
		? (periodIncomeItems ?? [])
		: ((incomeByMonth?.[monthKey] ?? []));
	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

	let plannedExpenses = 0;
	let paidExpenses = 0;
	let selectedPlanExpenses = 0;
	let additionalPlansExpenses = 0;
	let selectedPlanPreview: ExpenseTooltipPreview = { items: [], remainingCount: 0 };
	let additionalPlansPreview: ExpenseTooltipPreview = { items: [], remainingCount: 0 };
	let paidExpensesFromIncome = 0;
	let periodPaidDebtFromIncome: number | null = null;
	let periodPaidDebtAllSources: number | null = null;
	if (cadence === "monthly") {
		plannedExpenses = expenseSnapshot?.plannedExpenses ?? 0;
		paidExpenses = expenseSnapshot?.paidExpenses ?? 0;
		selectedPlanExpenses = expenseSnapshot?.selectedPlanExpenses ?? 0;
		additionalPlansExpenses = expenseSnapshot?.additionalPlansExpenses ?? 0;
		selectedPlanPreview = expenseSnapshot?.selectedPlanPreview ?? selectedPlanPreview;
		additionalPlansPreview = expenseSnapshot?.additionalPlansPreview ?? additionalPlansPreview;

		// Paid expenses: get ALL income-sourced payments for this period's expenses,
		// regardless of when the payment was made. If the user paid a bill early
		// (before payday), it should still reduce "income remaining".
		const periodExpenseIds = expenseSnapshot?.expenseIds ?? [];
		const periodLoggedExpenseIds = expenseSnapshot?.loggedExpenseIds ?? [];

		if (!isHomeCoreMode && periodExpenseIds.length > 0) {
			const paidAgg = await prisma.expensePayment.aggregate({
				where: {
					expenseId: { in: periodExpenseIds },
					source: "income",
				},
				_sum: { amount: true },
			});
			paidExpensesFromIncome = decimalToNumber(paidAgg._sum.amount);
		}

		if (!isHomeCoreMode && periodLoggedExpenseIds.length > 0) {
			const loggedPaidAgg = await prisma.expensePayment.aggregate({
				where: {
					expenseId: { in: periodLoggedExpenseIds },
					source: "income",
				},
				_sum: { amount: true },
			});
			paidExpensesFromIncome += decimalToNumber(loggedPaidAgg._sum.amount);
		}

		// Debt payment totals are already period-scoped via getMonthlyDebtPlan.
		periodPaidDebtAllSources = debtPlan?.totalPaidDebtPayments ?? null;
		periodPaidDebtFromIncome = debtPlan?.paidDebtPaymentsFromIncome ?? null;
	} else {
		const expenseRows = await prisma.expense.findMany({
			where: { budgetPlanId: { in: expensePlanIds }, year, month, isAllocation: false, isMovedToDebt: false },
			select: {
				id: true,
				name: true,
				budgetPlanId: true,
				amount: true,
				paidAmount: true,
				isExtraLoggedExpense: true,
				paymentSource: true,
			},
		});
		const includedExpenseRows = expenseRows.filter((expense) => includeInPlannedExpenseTotals(expense));
		plannedExpenses = includedExpenseRows.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
		paidExpenses = includedExpenseRows.reduce((sum, expense) => sum + decimalToNumber(expense.paidAmount), 0);
		selectedPlanExpenses = includedExpenseRows
			.filter((expense) => expense.budgetPlanId === budgetPlanId)
			.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
		additionalPlansExpenses = includedExpenseRows
			.filter((expense) => expense.budgetPlanId !== budgetPlanId)
			.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
		selectedPlanPreview = buildExpenseTooltipPreview(
			includedExpenseRows.filter((expense) => expense.budgetPlanId === budgetPlanId),
			expensePlanNamesById
		);
		additionalPlansPreview = buildExpenseTooltipPreview(
			includedExpenseRows.filter((expense) => expense.budgetPlanId !== budgetPlanId),
			expensePlanNamesById
		);
		paidExpensesFromIncome = paidExpenses;
	}

	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
	const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
	const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

	const plannedDebtPayments = plannedDebtOnly?.plannedDebtPayments ?? debtPlan?.plannedDebtPayments ?? 0;
	const totalPaidDebtPayments = periodPaidDebtAllSources ?? debtPlan?.totalPaidDebtPayments ?? 0;
	// Use period-based debt payment total when available (monthly cadence);
	// otherwise fall back to the calendar year/month from getMonthlyDebtPlan.
	const paidDebtPaymentsFromIncome = periodPaidDebtFromIncome ?? debtPlan?.paidDebtPaymentsFromIncome ?? 0;

	const plannedBills = plannedExpenses + plannedDebtPayments;
	const paidBillsSoFar = paidExpenses + totalPaidDebtPayments;
	const remainingExpenseBills = Math.max(0, plannedExpenses - paidExpenses);
	const remainingDebtBills = Math.max(0, plannedDebtPayments - totalPaidDebtPayments);
	const remainingBills = remainingExpenseBills + remainingDebtBills;
	const moneyLeftAfterPlan = grossIncome - plannedBills - plannedSetAside;
	const spendableIncomeRightNow = grossIncome - paidExpensesFromIncome - paidDebtPaymentsFromIncome - plannedSetAside;
	const leftToPayRightNow = remainingBills;
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
		expenseBreakdown: {
			selectedPlanExpenses,
			additionalPlansExpenses,
			selectedPlanPreview,
			additionalPlansPreview,
		},
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
		remainingExpenseBills,
		remainingDebtBills,
		remainingBills,
		moneyLeftAfterPlan,
		incomeLeftRightNow: spendableIncomeRightNow,
		spendableIncomeRightNow,
		leftToPayRightNow,
		moneyOutTotal,
		isOnPlan: moneyLeftAfterPlan >= 0,
	};
}
