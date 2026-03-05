import { prisma } from "@/lib/prisma";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { getAllIncome } from "@/lib/income/store";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { resolveActivePayPeriodWindow, type PayFrequency } from "@/lib/payPeriods";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import type { ExpenseItem } from "@/types";

let supportsDashboardIsMovedToDebtField: boolean | null = null;

export type DashboardGoalLike = {
	id: string;
	title: string;
	type: "yearly" | "long-term" | "long_term" | "short_term" | "short-term";
	category: "debt" | "savings" | "emergency" | "investment" | "other";
	description?: string;
	targetAmount?: number;
	currentAmount?: number;
	targetYear?: number;
};

export type DashboardCategoryDataItem = {
	id: string;
	name: string;
	icon?: string;
	color?: string;
	total: number;
	expenses: ExpenseItem[];
};

export type DashboardPlanData = {
	year: number;
	monthNum: number;
	categoryData: DashboardCategoryDataItem[];
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	incomeAfterAllocations: number;
	totalExpenses: number;
	remaining: number;
	goals: DashboardGoalLike[];
};

export async function getDashboardPlanData(
	planId: string,
	now: Date,
	opts?: { ensureDefaultCategories?: boolean }
): Promise<DashboardPlanData> {
	const isUnknownMovedToDebtFieldError = (error: unknown) => {
		const message = String((error as { message?: unknown })?.message ?? error);
		return (
			message.includes("isMovedToDebt") &&
			(message.includes("Unknown arg") ||
				message.includes("Unknown argument") ||
				message.includes("Unknown field"))
		);
	};

	const ensureDefaultCategories = opts?.ensureDefaultCategories ?? true;
	// Keep category defaults in sync even if the DB predates new defaults.
	if (ensureDefaultCategories) {
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });
	}

	const selectedYear = now.getFullYear();
	const selectedMonthNum = now.getMonth() + 1; // 1-12
	const selectedMonthKey = monthNumberToKey(selectedMonthNum);

	const expensesPromise = (async () => {
		const runLegacyQuery = () =>
			prisma.expense.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			});

		if (supportsDashboardIsMovedToDebtField === false || !(await supportsExpenseMovedToDebtField())) {
			supportsDashboardIsMovedToDebtField = false;
			return runLegacyQuery();
		}

		try {
			const rows = await prisma.expense.findMany({
				where: {
					budgetPlanId: planId,
					year: selectedYear,
					month: selectedMonthNum,
					isMovedToDebt: false,
				},
			});
			supportsDashboardIsMovedToDebtField = true;
			return rows;
		} catch (error) {
			// If Prisma Client wasn't regenerated yet, this field won't exist.
			// Fall back to the legacy query rather than 500'ing the whole dashboard.
			if (isUnknownMovedToDebtFieldError(error)) {
				supportsDashboardIsMovedToDebtField = false;
				return runLegacyQuery();
			}
			throw error;
		}
	})();

	const [categories, expenses, income, goals, allocation, customAllocations, debtPlan] =
		await Promise.all([
			prisma.category.findMany({ where: { budgetPlanId: planId } }),
			expensesPromise,
			prisma.income.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			}),
			prisma.goal.findMany({ where: { budgetPlanId: planId } }),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyCustomAllocationsSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyDebtPlan({
				budgetPlanId: planId,
				year: selectedYear,
				month: selectedMonthNum,
			}),
		]);

	const serializedGoals: DashboardGoalLike[] = goals.map((g) => ({
		id: g.id,
		title: g.title,
		type: g.type,
		category: g.category,
		description: g.description ?? undefined,
		targetAmount: g.targetAmount == null ? undefined : Number(g.targetAmount),
		currentAmount: g.currentAmount == null ? undefined : Number(g.currentAmount),
		targetYear: g.targetYear ?? undefined,
	}));

	const categoryLookup = categories.reduce(
		(acc, cat) => {
			acc[cat.id] = cat;
			return acc;
		},
		{} as Record<string, (typeof categories)[number]>
	);

	const regularExpenses = expenses.map((e) => ({
		id: e.id,
		name: e.name,
		amount: Number(e.amount),
		paid: e.paid,
		paidAmount: Number(e.paidAmount),
		categoryId: e.categoryId ?? undefined,
	}));

	const monthIncome = income.map((i) => ({
		id: i.id,
		name: i.name,
		amount: Number(i.amount),
	}));

	const categoryTotals = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
		}
		return acc;
	}, {} as Record<string, number>);

	const uncategorizedExpenses = regularExpenses.filter((e) => !e.categoryId);
	const uncategorizedTotal = uncategorizedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

	const expensesByCategory = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			if (!acc[e.categoryId]) acc[e.categoryId] = [];
			acc[e.categoryId].push(e);
		}
		return acc;
	}, {} as Record<string, typeof regularExpenses>);

	const categoryData: DashboardCategoryDataItem[] = Object.entries(categoryTotals)
		.map(([catId, total]) => ({
			...categoryLookup[catId],
			icon: categoryLookup[catId]?.icon ?? undefined,
			color: categoryLookup[catId]?.color ?? undefined,
			total,
			expenses: expensesByCategory[catId] || [],
		}))
		.filter((c) => c.name)
		.sort((a, b) => b.total - a.total);

	if (uncategorizedTotal > 0) {
		categoryData.push({
			id: "uncategorized",
			name: "Miscellaneous",
			icon: "Circle",
			color: "slate",
			total: uncategorizedTotal,
			expenses: uncategorizedExpenses,
		});
		categoryData.sort((a, b) => b.total - a.total);
	}

	const plannedDebtAmount = debtPlan.plannedDebtPayments;
	const customSetAsideTotal = Number(customAllocations.total ?? 0);

	const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	// Include custom sacrifice items so this matches the income-month BFF calculation
	const totalAllocations =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0) +
		customSetAsideTotal;

	const plannedSavingsContribution = allocation.monthlySavingsContribution ?? 0;
	const plannedEmergencyContribution = allocation.monthlyEmergencyContribution ?? 0;
	const plannedInvestments = allocation.monthlyInvestmentContribution ?? 0;

	const incomeAfterAllocations = totalIncome - totalAllocations - plannedDebtAmount;

	return {
		year: selectedYear,
		monthNum: selectedMonthNum,
		categoryData,
		totalIncome,
		totalAllocations,
		plannedDebtPayments: plannedDebtAmount,
		plannedSavingsContribution,
		plannedEmergencyContribution,
		plannedInvestments,
		incomeAfterAllocations,
		totalExpenses,
		remaining,
		goals: serializedGoals,
	};
}

function parseIsoDateOnlyToUtc(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m, d] = iso.split("-").map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(Date.UTC(y, m - 1, d));
}

function inRangeUtc(target: Date, start: Date, end: Date): boolean {
	return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

function normalizeSeriesOrName(seriesKey: unknown, name: unknown): string {
	const raw = typeof seriesKey === "string" && seriesKey.trim().length > 0
		? seriesKey
		: typeof name === "string"
			? name
			: "";
	return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseIsoYearMonth(iso: string): { year: number; month: number } | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m] = iso.split("-").slice(0, 2).map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
	return { year: y, month: m };
}

function normalizeIncomeKey(name: unknown): string {
	return String(name ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

/**
 * Pay-period-aware version of dashboard plan data.
 *
 * - Income/allocations/debt plans are taken from the pay-period *end* month.
 * - Expenses are filtered to only those due within the active pay-period window.
 */
export async function getDashboardPlanDataForActivePayPeriod(
	planId: string,
	params: {
		now: Date;
		payDate: number;
		payFrequency: PayFrequency;
		ensureDefaultCategories?: boolean;
	}
): Promise<DashboardPlanData> {
	const { now, payDate, payFrequency } = params;
	const ensureDefaultCategories = params.ensureDefaultCategories ?? true;

	// Keep category defaults in sync even if the DB predates new defaults.
	if (ensureDefaultCategories) {
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });
	}

	const window = resolveActivePayPeriodWindow({
		now,
		payDate: Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1,
		payFrequency,
	});

	// Monthly snapshots (income, allocations, debt plan) remain month-based,
	// and should correspond to the pay-period *end* month.
	const selectedYear = window.end.getUTCFullYear();
	const selectedMonthNum = window.end.getUTCMonth() + 1;
	const selectedMonthKey = monthNumberToKey(selectedMonthNum);
	const startYear = window.start.getUTCFullYear();
	const startMonthNum = window.start.getUTCMonth() + 1;
	const startMonthKey = monthNumberToKey(startMonthNum);

	const isUnknownMovedToDebtFieldError = (error: unknown) => {
		const message = String((error as { message?: unknown })?.message ?? error);
		return (
			message.includes("isMovedToDebt") &&
			(message.includes("Unknown arg") ||
				message.includes("Unknown argument") ||
				message.includes("Unknown field"))
		);
	};

	const [categories, expenses, income, goals, allocation, customAllocations, debtPlan] =
		await Promise.all([
			prisma.category.findMany({ where: { budgetPlanId: planId } }),
			(async () => {
				const periodPairs = [
					{ year: window.start.getUTCFullYear(), month: window.start.getUTCMonth() + 1 },
					{ year: window.end.getUTCFullYear(), month: window.end.getUTCMonth() + 1 },
					{
						year: new Date(Date.UTC(window.start.getUTCFullYear(), window.start.getUTCMonth() - 1, 1)).getUTCFullYear(),
						month: new Date(Date.UTC(window.start.getUTCFullYear(), window.start.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
					},
					{
						year: new Date(Date.UTC(window.end.getUTCFullYear(), window.end.getUTCMonth() + 1, 1)).getUTCFullYear(),
						month: new Date(Date.UTC(window.end.getUTCFullYear(), window.end.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
					},
				];
				const uniquePairs = Array.from(new Map(periodPairs.map((p) => [`${p.year}-${p.month}`, p])).values());

				const runLegacyQuery = () =>
					prisma.expense.findMany({
						where: { budgetPlanId: planId, OR: uniquePairs },
						select: {
							id: true,
							name: true,
							seriesKey: true,
							merchantDomain: true,
							logoUrl: true,
							logoSource: true,
							amount: true,
							paid: true,
							paidAmount: true,
							categoryId: true,
							isAllocation: true,
							isDirectDebit: true,
							dueDate: true,
							year: true,
							month: true,
						},
						orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
					});

				if (!(await supportsExpenseMovedToDebtField())) {
					return runLegacyQuery();
				}

				try {
					return await prisma.expense.findMany({
						where: { budgetPlanId: planId, OR: uniquePairs, isMovedToDebt: false },
						select: {
							id: true,
							name: true,
							seriesKey: true,
							merchantDomain: true,
							logoUrl: true,
							logoSource: true,
							amount: true,
							paid: true,
							paidAmount: true,
							categoryId: true,
							isAllocation: true,
							isDirectDebit: true,
							dueDate: true,
							year: true,
							month: true,
							isMovedToDebt: true,
						},
						orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
					});
				} catch (error) {
					if (!isUnknownMovedToDebtFieldError(error)) throw error;
					return runLegacyQuery();
				}
			})(),
			(async () => {
				// Income rows are month-scoped (no date range), but pay periods can span 2 calendar
				// months. To avoid "missing" carryover/one-off income due to the historic month
				// shifting bug, we merge:
				// - canonical income for the pay-period end month
				// - plus any additional canonical income items from the start month that don't
				//   already exist in the end-month snapshot (by normalized name)
				if (payFrequency !== "monthly") {
					const incomeByMonth = await getAllIncome(planId, selectedYear);
					return incomeByMonth[selectedMonthKey] ?? [];
				}

				const [incomeEndYear, incomeStartYear] = await Promise.all([
					getAllIncome(planId, selectedYear),
					startYear === selectedYear ? Promise.resolve(null) : getAllIncome(planId, startYear),
				]);

				const endItems = incomeEndYear[selectedMonthKey] ?? [];
				const startItems =
					(startYear === selectedYear
						? incomeEndYear[startMonthKey]
						: incomeStartYear?.[startMonthKey]) ?? [];

				const endKeys = new Set(endItems.map((i) => normalizeIncomeKey(i.name)).filter(Boolean));
				const extraStartItems = startItems.filter((i) => {
					const key = normalizeIncomeKey(i.name);
					return Boolean(key) && !endKeys.has(key);
				});

				return [...endItems, ...extraStartItems];
			})(),
			prisma.goal.findMany({ where: { budgetPlanId: planId } }),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyCustomAllocationsSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyDebtPlan({
				budgetPlanId: planId,
				year: selectedYear,
				month: selectedMonthNum,
				periodKey: getPeriodKey(window.start, payDate),
				periodStart: window.start,
			}),
		]);

	const serializedGoals: DashboardGoalLike[] = goals.map((g) => ({
		id: g.id,
		title: g.title,
		type: g.type,
		category: g.category,
		description: g.description ?? undefined,
		targetAmount: g.targetAmount == null ? undefined : Number(g.targetAmount),
		currentAmount: g.currentAmount == null ? undefined : Number(g.currentAmount),
		targetYear: g.targetYear ?? undefined,
	}));

	const categoryLookup = categories.reduce(
		(acc, cat) => {
			acc[cat.id] = cat;
			return acc;
		},
		{} as Record<string, (typeof categories)[number]>
	);

	const filteredAndDeduped: any[] = [];
	const seen = new Map<string, { exp: any; rank: number }>();

	for (const exp of expenses as any[]) {
		if (isLegacyPlaceholderExpenseRow(exp)) continue;

		// Allocations/envelopes are tracked separately and should not appear as bills.
		if (Boolean(exp.isAllocation ?? false)) continue;

		const series = normalizeSeriesOrName(exp.seriesKey, exp.name);
		const amount = Number(exp.amount ?? 0);

		if (exp.dueDate) {
			const dueIso = resolveEffectiveDueDateIso(
				{
					id: exp.id,
					name: exp.name,
					amount,
					paid: Boolean(exp.paid),
					paidAmount: Number(exp.paidAmount ?? 0),
					dueDate: exp.dueDate ? new Date(exp.dueDate).toISOString().slice(0, 10) : undefined,
				},
				{ year: exp.year, monthNum: exp.month, payDate }
			);
			if (!dueIso) continue;
			const due = parseIsoDateOnlyToUtc(dueIso);
			if (!due) continue;
			if (!inRangeUtc(due, window.start, window.end)) continue;

			const key = `${series}|${dueIso}|${amount}`;
			const dueYm = parseIsoYearMonth(dueIso);
			const rank = dueYm && exp.year === dueYm.year && exp.month === dueYm.month ? 0 : 1;

			const existing = seen.get(key);
			if (!existing) {
				seen.set(key, { exp: { ...exp, __effectiveDueIso: dueIso }, rank });
				continue;
			}
			if (rank < existing.rank) {
				seen.set(key, { exp: { ...exp, __effectiveDueIso: dueIso }, rank });
			}
			continue;
		}

		// Unscheduled expenses (no due date) are still part of pay-period totals
		// when they are saved under the pay-period anchor (end) month.
		if (exp.year !== selectedYear || exp.month !== selectedMonthNum) continue;
		const dedupeScope = `unscheduled:${selectedYear}-${selectedMonthNum}`;
		const key = `${series}|${dedupeScope}|${amount}`;
		const rank = 0;

		const existing = seen.get(key);
		if (!existing) {
			seen.set(key, { exp, rank });
			continue;
		}
		if (rank < existing.rank) {
			seen.set(key, { exp, rank });
		}
	}

	for (const v of seen.values()) filteredAndDeduped.push(v.exp);

	const regularExpenses: ExpenseItem[] = filteredAndDeduped.map((e) => ({
		id: e.id,
		name: e.name,
		merchantDomain: e.merchantDomain ?? undefined,
		logoUrl: e.logoUrl ?? undefined,
		logoSource: e.logoSource ?? undefined,
		amount: Number(e.amount),
		paid: e.paid,
		paidAmount: Number(e.paidAmount),
		categoryId: e.categoryId ?? undefined,
		isAllocation: Boolean(e.isAllocation ?? false),
		isDirectDebit: Boolean(e.isDirectDebit ?? false),
		dueDate: e.dueDate instanceof Date ? e.dueDate.toISOString().slice(0, 10) : undefined,
	}));

	const monthIncome = (income as any[]).map((i) => ({
		id: i.id,
		name: i.name,
		amount: Number(i.amount),
	}));

	const categoryTotals = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
		}
		return acc;
	}, {} as Record<string, number>);

	const uncategorizedExpenses = regularExpenses.filter((e) => !e.categoryId);
	const uncategorizedTotal = uncategorizedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

	const expensesByCategory = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			if (!acc[e.categoryId]) acc[e.categoryId] = [];
			acc[e.categoryId].push(e);
		}
		return acc;
	}, {} as Record<string, ExpenseItem[]>);

	const categoryData: DashboardCategoryDataItem[] = Object.entries(categoryTotals)
		.map(([catId, total]) => ({
			...categoryLookup[catId],
			icon: categoryLookup[catId]?.icon ?? undefined,
			color: categoryLookup[catId]?.color ?? undefined,
			total,
			expenses: expensesByCategory[catId] || [],
		}))
		.filter((c) => c.name)
		.sort((a, b) => b.total - a.total);

	if (uncategorizedTotal > 0) {
		categoryData.push({
			id: "uncategorized",
			name: "Miscellaneous",
			icon: "Circle",
			color: "slate",
			total: uncategorizedTotal,
			expenses: uncategorizedExpenses,
		});
		categoryData.sort((a, b) => b.total - a.total);
	}

	const plannedDebtAmount = debtPlan.plannedDebtPayments;
	const customSetAsideTotal = Number(customAllocations.total ?? 0);
	const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	const totalAllocations =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0) +
		customSetAsideTotal;

	const plannedSavingsContribution = allocation.monthlySavingsContribution ?? 0;
	const plannedEmergencyContribution = allocation.monthlyEmergencyContribution ?? 0;
	const plannedInvestments = allocation.monthlyInvestmentContribution ?? 0;

	const incomeAfterAllocations = totalIncome - totalAllocations - plannedDebtAmount;

	return {
		year: selectedYear,
		monthNum: selectedMonthNum,
		categoryData,
		totalIncome,
		totalAllocations,
		plannedDebtPayments: plannedDebtAmount,
		plannedSavingsContribution,
		plannedEmergencyContribution,
		plannedInvestments,
		incomeAfterAllocations,
		totalExpenses,
		remaining,
		goals: serializedGoals,
	};
}
