import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey, monthNumberToKey, monthKeyToNumber } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import { isMonthKey } from "@/lib/budget/zero-based";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { getAllIncome } from "@/lib/income/store";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import {
	getMonthlyAllocationSnapshot,
	getMonthlyCustomAllocationsSnapshot,
	type MonthlyAllocationSnapshot,
	type MonthlyCustomAllocationsSnapshot,
} from "@/lib/allocations/store";

import type { IncomeByMonth, IncomeTabKey, MonthlyAllocationSummaryRow } from "@/types/components/income";

function isPastMonthForYear(month: MonthKey, year: number, now: Date): boolean {
	const currentYear = now.getFullYear();
	if (year < currentYear) return true;
	if (year > currentYear) return false;
	const currentMonth = currentMonthKey(now);
	return monthKeyToNumber(month) < monthKeyToNumber(currentMonth);
}

function firstString(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return String(value[0] ?? "");
	return typeof value === "string" ? value : "";
}

function parseIncomeTab(searchParams: Record<string, string | string[] | undefined>): IncomeTabKey {
	const tab = firstString(searchParams.tab);
	return tab === "allocations" || tab === "income" ? tab : "income";
}

function coerceYear(value: string): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : NaN;
}

function parseAllocMonth(searchParams: Record<string, string | string[] | undefined>, now: Date): MonthKey {
	const raw = firstString(searchParams.month);
	return isMonthKey(String(raw ?? "")) ? (String(raw) as MonthKey) : currentMonthKey(now);
}

function normalizeHorizonYears(raw: unknown): number {
	const n = Number(raw ?? 10);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

export type AdminIncomePageData = {
	budgetPlanId: string;
	initialTab: IncomeTabKey;
	nowMonth: MonthKey;
	showYearPicker: boolean;
	allYears: number[];
	selectedIncomeYear: number;
	hasAvailableMonths: boolean;
	monthsWithoutIncome: MonthKey[];
	defaultMonth: MonthKey;
	incomeForIncomeTab: IncomeByMonth;
	allocMonth: MonthKey;
	allocation: MonthlyAllocationSnapshot;
	incomeForAllocations: IncomeByMonth;
	customAllocations: MonthlyCustomAllocationsSnapshot;
	hasOverridesForAllocMonth: boolean;
	monthlyAllocationSummaries: MonthlyAllocationSummaryRow[];
	grossIncomeForAllocMonth: number;
	totalAllocationsForAllocMonth: number;
	remainingToBudgetForAllocMonth: number;
};

export async function getAdminIncomePageData(options: {
	searchParams: Record<string, string | string[] | undefined>;
	sessionUserId?: string;
	sessionUsername: string;
	now?: Date;
}): Promise<AdminIncomePageData> {
	const now = options.now ?? new Date();
	const nowMonth = currentMonthKey(now);

	const requestedPlanId = firstString(options.searchParams.plan);

	const userId = await resolveUserId({ userId: options.sessionUserId, username: options.sessionUsername });

	if (!requestedPlanId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: options.sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(options.sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/income`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: requestedPlanId } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: options.sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(options.sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/income`);
	}

	const budgetPlanId = budgetPlan.id;
	const currentYear = now.getFullYear();

	const incomeYearMonthCoverage = await prisma.income.groupBy({
		by: ["year", "month"],
		where: { budgetPlanId },
		_count: { _all: true },
	});

	const requestedYear = coerceYear(firstString(options.searchParams.year));

	const horizonYears = normalizeHorizonYears((budgetPlan as any).budgetHorizonYears ?? 10);
	const plannedYears = Array.from({ length: horizonYears }, (_, i) => currentYear + i);
	const allYears = plannedYears.slice().sort((a, b) => a - b);

	const monthsWithIncomeByYear = new Map<number, Set<MonthKey>>();
	for (const row of incomeYearMonthCoverage) {
		const set = monthsWithIncomeByYear.get(row.year) ?? new Set<MonthKey>();
		set.add(monthNumberToKey(row.month));
		monthsWithIncomeByYear.set(row.year, set);
	}

	const missingMonthsByYear: Record<number, MonthKey[]> = {};
	for (const y of allYears) {
		const set = monthsWithIncomeByYear.get(y) ?? new Set<MonthKey>();
		missingMonthsByYear[y] = (MONTHS as MonthKey[]).filter((m) => !set.has(m) && !isPastMonthForYear(m, y, now));
	}

	const showYearPicker = allYears.length > 1;
	const selectedIncomeYear =
		Number.isFinite(requestedYear) && allYears.includes(requestedYear)
			? requestedYear
			: allYears.includes(currentYear)
				? currentYear
				: (allYears[0] ?? currentYear);

	const incomeForIncomeTab = await getAllIncome(budgetPlanId, selectedIncomeYear);

	const allocMonth = parseAllocMonth(options.searchParams, now);
	const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, allocMonth);
	const incomeForAllocations = await getAllIncome(budgetPlanId, allocation.year);
	const customAllocations = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, allocMonth, { year: allocation.year });
	const hasOverridesForAllocMonth = allocation.isOverride || customAllocations.items.some((item) => item.isOverride);

	const monthlyAllocationSummaries = await Promise.all(
		MONTHS.map(async (m) => {
			const alloc = await getMonthlyAllocationSnapshot(budgetPlanId, m);
			const custom = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, m, { year: alloc.year });
			const grossIncome = (incomeForAllocations[m] ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
			const fixedTotal =
				(alloc.monthlyAllowance ?? 0) +
				(alloc.monthlySavingsContribution ?? 0) +
				(alloc.monthlyEmergencyContribution ?? 0) +
				(alloc.monthlyInvestmentContribution ?? 0);
			const customTotal = custom.total ?? 0;
			const total = fixedTotal + customTotal;
			const row: MonthlyAllocationSummaryRow = {
				month: m,
				year: alloc.year,
				grossIncome,
				fixedTotal,
				customTotal,
				total,
				leftToBudget: grossIncome - total,
				customCount: custom.items.length,
			};
			return row;
		})
	);

	const grossIncomeForAllocMonth = (incomeForAllocations[allocMonth] ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
	const fixedAllocationsForAllocMonth =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0);
	const totalAllocationsForAllocMonth = fixedAllocationsForAllocMonth + (customAllocations.total ?? 0);
	const remainingToBudgetForAllocMonth = grossIncomeForAllocMonth - totalAllocationsForAllocMonth;

	const monthsWithoutIncome = missingMonthsByYear[selectedIncomeYear] ?? [];
	const hasAvailableMonths = monthsWithoutIncome.length > 0;
	const defaultMonth: MonthKey = (monthsWithoutIncome.includes(nowMonth) ? nowMonth : monthsWithoutIncome[0]) || nowMonth;

	return {
		budgetPlanId,
		initialTab: parseIncomeTab(options.searchParams),
		nowMonth,
		showYearPicker,
		allYears,
		selectedIncomeYear,
		hasAvailableMonths,
		monthsWithoutIncome,
		defaultMonth,
		incomeForIncomeTab,
		allocMonth,
		allocation,
		incomeForAllocations,
		customAllocations,
		hasOverridesForAllocMonth,
		monthlyAllocationSummaries,
		grossIncomeForAllocMonth,
		totalAllocationsForAllocMonth,
		remainingToBudgetForAllocMonth,
	};
}
