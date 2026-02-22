"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { updatePaymentStatus as updateExpensePaymentStatus } from "@/lib/expenses/actions";
import { buildScopedPageHref } from "@/lib/helpers/scopedPageHref";
import type {
	BudgetPlan,
	DashboardCombinedData,
	LargestExpensesCardModel,
	LargestExpenseSection,
	MonthKey,
	PaymentStatus,
	TabKey,
	ViewTabsProps,
} from "@/types";
import { useBudgetPlans } from "@/lib/hooks/useBudgetPlans";

function resolveTabKind(planKind: string | undefined | null): TabKey {
	const kind = String(planKind ?? "").toLowerCase();
	if (kind === "holiday" || kind === "carnival" || kind === "personal") return kind as TabKey;
	return "personal";
}

export function useViewTabsDashboardModel(props: ViewTabsProps) {
	const {
		budgetPlanId,
		month,
		categoryData,
		totalIncome,
		totalAllocations,
		plannedDebtPayments,
		plannedSavingsContribution,
		plannedEmergencyContribution,
		plannedInvestments,
		incomeAfterAllocations,
		totalExpenses,
		remaining,
		goals,
		incomeMonthsCoverageByPlan,
		allPlansData,
		largestExpensesByPlan,
	} = props;

	const pathname = usePathname();
	const budgetPlans = useBudgetPlans({ budgetPlanId });

	const expensesHref = useMemo(() => buildScopedPageHref(pathname, "expenses"), [pathname]);
	const incomeHref = useMemo(() => buildScopedPageHref(pathname, "income"), [pathname]);

	const resolvedActiveTab = useMemo<TabKey>(() => {
		const current = budgetPlans.find((p) => p.id === budgetPlanId);
		return resolveTabKind(current?.kind);
	}, [budgetPlanId, budgetPlans]);

	const activePlans = useMemo<BudgetPlan[]>(() => {
		const current = budgetPlans.find((p) => p.id === budgetPlanId);
		return current ? [current] : [];
	}, [budgetPlanId, budgetPlans]);

	const shouldShowAddIncome = useMemo(() => {
		if (!incomeMonthsCoverageByPlan) return true;
		return (incomeMonthsCoverageByPlan[budgetPlanId] ?? 0) < 12;
	}, [budgetPlanId, incomeMonthsCoverageByPlan]);

	const fallbackPlanData = useMemo(() => {
		const fromAllPlans = allPlansData?.[budgetPlanId];
		if (fromAllPlans) return fromAllPlans;

		return {
			categoryData,
			totalIncome,
			totalAllocations,
			plannedDebtPayments,
			plannedSavingsContribution,
			plannedEmergencyContribution,
			plannedInvestments,
			incomeAfterAllocations,
			totalExpenses,
			remaining,
			goals,
		};
	}, [
		allPlansData,
		budgetPlanId,
		categoryData,
		goals,
		incomeAfterAllocations,
		plannedDebtPayments,
		plannedEmergencyContribution,
		plannedInvestments,
		plannedSavingsContribution,
		remaining,
		totalAllocations,
		totalExpenses,
		totalIncome,
	]);

	const combinedData = useMemo<DashboardCombinedData>(() => {
		const allocationsTotal = fallbackPlanData.totalAllocations ?? 0;
		const plannedDebtTotal = fallbackPlanData.plannedDebtPayments ?? 0;
		const leftToBudget =
			typeof fallbackPlanData.incomeAfterAllocations === "number"
				? fallbackPlanData.incomeAfterAllocations
				: fallbackPlanData.totalIncome - allocationsTotal;

		return {
			totalIncome: fallbackPlanData.totalIncome,
			totalAllocations: allocationsTotal,
			plannedDebtPayments: plannedDebtTotal,
			incomeAfterAllocations: leftToBudget,
			totalExpenses: fallbackPlanData.totalExpenses,
			remaining: fallbackPlanData.remaining,
			amountLeftToBudget: leftToBudget,
			plannedSavingsContribution: fallbackPlanData.plannedSavingsContribution ?? 0,
			plannedEmergencyContribution: fallbackPlanData.plannedEmergencyContribution ?? 0,
			plannedInvestments: fallbackPlanData.plannedInvestments ?? 0,
			categoryTotals: fallbackPlanData.categoryData.map((c) => ({
				name: c.name,
				total: c.total,
				color: c.color,
			})),
			goals: fallbackPlanData.goals,
			flattenedExpenses: fallbackPlanData.categoryData.flatMap((c) => c.expenses ?? []),
		};
	}, [fallbackPlanData]);

	const projectionHorizonYears = useMemo(() => {
		const horizons = activePlans
			.map((p) => (typeof p.budgetHorizonYears === "number" ? p.budgetHorizonYears : undefined))
			.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
		if (horizons.length === 0) return 10;
		return Math.max(...horizons);
	}, [activePlans]);

	const topCategories = useMemo(() => {
		return [...combinedData.categoryTotals]
			.filter((c) => c.total > 0)
			.sort((a, b) => b.total - a.total)
			.slice(0, 6);
	}, [combinedData.categoryTotals]);

	const largestExpenses = useMemo(() => {
		return [...combinedData.flattenedExpenses]
			.filter((e) => Number(e.amount) > 0)
			.sort((a, b) => b.amount - a.amount)
			.slice(0, 6)
			.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) }));
	}, [combinedData.flattenedExpenses]);

	const largestExpensesCard = useMemo<LargestExpensesCardModel>(() => {
		const planCount = budgetPlans.length > 0 ? budgetPlans.length : Object.keys(allPlansData ?? {}).length;
		const hasEventPlans =
			budgetPlans.length > 0
				? budgetPlans.some(
						(p) => String(p.kind).toLowerCase() === "carnival" || String(p.kind).toLowerCase() === "holiday"
					)
				: Object.values(allPlansData ?? {}).some(
						(p) => (p as any)?.kind === "carnival" || (p as any)?.kind === "holiday"
					);

		const isSinglePlan = !planCount || planCount <= 1;
		const shouldShowGrouped = !isSinglePlan && hasEventPlans && budgetPlans.length > 0;

		const title = shouldShowGrouped ? "Largest expenses (by plan)" : "Largest expenses";
		if (!shouldShowGrouped) {
			return {
				title,
				sections: [],
				flat: largestExpenses,
				showEventDivider: false,
			};
		}

		const byKindLatest = (kind: "personal" | "carnival" | "holiday") => {
			const filtered = budgetPlans
				.filter((p) => String(p.kind).toLowerCase() === kind)
				.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
			return filtered[0] ?? null;
		};

		const personalPlan = byKindLatest("personal");
		const carnivalPlan = byKindLatest("carnival");
		const holidayPlan = byKindLatest("holiday");

		const getTopExpenses = (planId: string, limit: number) => {
			const byPlan = largestExpensesByPlan?.[planId];
			if (byPlan && Array.isArray(byPlan.items)) {
				return byPlan.items.slice(0, limit);
			}

			const planData = allPlansData?.[planId];
			if (!planData) return [] as Array<{ id: string; name: string; amount: number }>;
			const flat = (planData.categoryData ?? []).flatMap((c) => c.expenses ?? []);
			return [...flat]
				.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) }))
				.filter((e) => Number.isFinite(e.amount) && e.amount > 0)
				.sort((a, b) => b.amount - a.amount)
				.slice(0, limit);
		};

		const perPlanMax = 3;
		const carnivalItems = carnivalPlan ? getTopExpenses(carnivalPlan.id, perPlanMax) : [];
		const holidayItems = holidayPlan ? getTopExpenses(holidayPlan.id, perPlanMax) : [];
		const personalItems = personalPlan ? getTopExpenses(personalPlan.id, perPlanMax) : [];

		const sections: LargestExpenseSection[] = [];
		if (personalPlan && personalItems.length > 0) sections.push({ key: "personal", label: "Personal", items: personalItems });
		if (carnivalPlan && carnivalItems.length > 0) sections.push({ key: "carnival", label: "Carnival", items: carnivalItems });
		if (holidayPlan && holidayItems.length > 0) sections.push({ key: "holiday", label: "Holiday", items: holidayItems });

		return {
			title,
			sections,
			flat: [],
			showEventDivider: Boolean(carnivalPlan && holidayPlan),
		};
	}, [allPlansData, budgetPlans, largestExpenses, largestExpensesByPlan]);

	const amountAfterExpenses = combinedData.amountLeftToBudget - combinedData.totalExpenses;
	const savingsRate = combinedData.totalIncome > 0 ? (combinedData.plannedSavingsContribution ?? 0) / combinedData.totalIncome : 0;
	const spendRate = combinedData.totalIncome > 0 ? combinedData.totalExpenses / combinedData.totalIncome : 0;

	const daysInMonth = useMemo(() => {
		const now = new Date();
		const year = now.getFullYear();
		const monthNumber = monthKeyToNumber(month);
		return new Date(year, monthNumber, 0).getDate();
	}, [month]);

	const avgSpendPerDay = daysInMonth > 0 ? combinedData.totalExpenses / daysInMonth : 0;

	const [showExpenseDetails, setShowExpenseDetails] = useState(false);

	const updatePaymentStatus = async (
		planId: string,
		monthKey: MonthKey,
		id: string,
		status: PaymentStatus,
		partialAmount?: number
	) => {
		await updateExpensePaymentStatus(planId, monthKey, id, status, partialAmount);
	};

	return {
		pathname,
		expensesHref,
		incomeHref,
		budgetPlans,
		resolvedActiveTab,
		activePlans,
		shouldShowAddIncome,
		fallbackPlanData,
		combinedData,
		projectionHorizonYears,
		topCategories,
		largestExpensesCard,
		amountAfterExpenses,
		savingsRate,
		spendRate,
		daysInMonth,
		avgSpendPerDay,
		showExpenseDetails,
		setShowExpenseDetails,
		updatePaymentStatus,
	};
}
