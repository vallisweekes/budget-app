import { MONTHS } from "@/lib/constants/time";
import { listBudgetPlansForUser, resolveUserId } from "@/lib/budgetPlans";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ViewTabs from "@/components/ViewTabs";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot } from "@/lib/allocations/store";
import type { ExpenseItem } from "@/types";
import { computePreviousMonthRecap, computeUpcomingPayments, computeRecapTips, type DatedExpenseItem } from "@/lib/expenses/insights";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { computeDebtTips } from "@/lib/debts/insights";

export const dynamic = "force-dynamic";

function currentMonth(): typeof MONTHS[number] {
	return currentMonthKey();
}

function addMonthsUtc(year: number, monthNum: number, delta: number): { year: number; monthNum: number } {
	const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
	return { year: d.getUTCFullYear(), monthNum: d.getUTCMonth() + 1 };
}

function toNumber(value: unknown): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	if (value && typeof value === "object") {
		const str = (value as { toString: () => string }).toString();
		const n = Number(str);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

export default async function DashboardView({ budgetPlanId }: { budgetPlanId: string }) {
	const now = new Date();
	const selectedYear = now.getFullYear();
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;

	// Function to process plan data
	const processPlanData = async (planId: string) => {
		// Keep category defaults in sync even if the DB predates new defaults.
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });

		const selectedYear = now.getFullYear();
		const selectedMonthNum = now.getMonth() + 1; // 1-12
		const selectedMonthKey = monthNumberToKey(selectedMonthNum);
		
		// Fetch all data from database for this plan
		const [categories, expenses, income, goals, allocation, debtPaymentsAgg, plannedDebtPayments] = await Promise.all([
			prisma.category.findMany({
				where: { budgetPlanId: planId },
			}),
			prisma.expense.findMany({
				where: {
					budgetPlanId: planId,
					year: selectedYear,
					month: selectedMonthNum,
				},
			}),
			prisma.income.findMany({
				where: {
					budgetPlanId: planId,
					year: selectedYear,
					month: selectedMonthNum,
				},
			}),
			prisma.goal.findMany({
				where: { budgetPlanId: planId },
			}),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			prisma.debtPayment.aggregate({
				where: {
					debt: { budgetPlanId: planId },
					year: selectedYear,
					month: selectedMonthNum,
					source: "income",
				},
				_sum: { amount: true },
			}),
			prisma.debt.aggregate({
				where: {
					budgetPlanId: planId,
					currentBalance: { gt: 0 },
				},
				_sum: { amount: true },
			}),
		]);
		
		// Serialize goals into plain objects (convert Decimal and nulls)
		const serializedGoals = goals.map((g) => ({
			id: g.id,
			title: g.title,
			type: g.type,
			category: g.category,
			description: g.description ?? undefined,
			targetAmount: g.targetAmount == null ? undefined : Number(g.targetAmount),
			currentAmount: g.currentAmount == null ? undefined : Number(g.currentAmount),
			targetYear: g.targetYear ?? undefined,
		}));
		
		const categoryLookup = categories.reduce((acc, cat) => {
			acc[cat.id] = cat;
			return acc;
		}, {} as Record<string, typeof categories[number]>);

		const regularExpenses = expenses.map(e => ({
			id: e.id,
			name: e.name,
			amount: Number(e.amount),
			paid: e.paid,
			paidAmount: Number(e.paidAmount),
			categoryId: e.categoryId ?? undefined,
		}));

		const monthIncome = income.map(i => ({
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

		const expensesByCategory = regularExpenses.reduce((acc, e) => {
			if (e.categoryId) {
				if (!acc[e.categoryId]) acc[e.categoryId] = [];
				acc[e.categoryId].push(e);
			}
			return acc;
		}, {} as Record<string, typeof regularExpenses>);

		const categoryData = Object.entries(categoryTotals)
			.map(([catId, total]) => ({
				...categoryLookup[catId],
				icon: categoryLookup[catId]?.icon ?? undefined,
				color: categoryLookup[catId]?.color ?? undefined,
				total,
				expenses: expensesByCategory[catId] || [],
			}))
			.filter((c) => c.name)
			.sort((a, b) => b.total - a.total);

		const debtPaymentsFromIncome = Number(debtPaymentsAgg._sum.amount?.toString?.() ?? debtPaymentsAgg._sum.amount ?? 0);
		const plannedDebtAmount = Number(plannedDebtPayments._sum.amount?.toString?.() ?? plannedDebtPayments._sum.amount ?? 0);
		const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
		const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
		const remaining = totalIncome - totalExpenses;

		const totalAllocations =
			(allocation.monthlyAllowance ?? 0) +
			(allocation.monthlySavingsContribution ?? 0) +
			(allocation.monthlyEmergencyContribution ?? 0) +
			(allocation.monthlyInvestmentContribution ?? 0);
		const plannedSavingsContribution = allocation.monthlySavingsContribution ?? 0;
		const incomeAfterAllocations = totalIncome - totalAllocations - plannedDebtAmount;

		return {
			year: selectedYear,
			monthNum: selectedMonthNum,
			categoryData,
			totalIncome,
			totalAllocations,
			plannedDebtPayments: plannedDebtAmount,
			plannedSavingsContribution,
			incomeAfterAllocations,
			totalExpenses,
			remaining,
			goals: serializedGoals,
		};
	};

	// Get current plan data
	const currentPlanData = await processPlanData(budgetPlanId);
	const month = MONTHS[currentPlanData.monthNum - 1] ?? currentMonth();

	const planMeta = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const payDate = Number(planMeta?.payDate ?? 1);

	const currentYear = now.getFullYear();
	const currentMonthNum = now.getMonth() + 1;
	const historyPairs = Array.from({ length: 6 }, (_, i) => addMonthsUtc(currentYear, currentMonthNum, -i));
	const historyOr = historyPairs.map((p) => ({ year: p.year, month: p.monthNum }));
	const prev = new Date(now);
	prev.setMonth(prev.getMonth() - 1);
	const prevYear = prev.getFullYear();
	const prevMonthNum = prev.getMonth() + 1;

	const insightRows = await prisma.expense.findMany({
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
	});

	const historyRows = await prisma.expense.findMany({
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
	});

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
			where: {
				budgetPlanId,
				OR: forecastOr,
			},
			select: {
				amount: true,
				year: true,
				month: true,
			},
		}),
		prisma.income.findMany({
			where: {
				budgetPlanId,
				OR: forecastOr,
			},
			select: {
				amount: true,
				year: true,
				month: true,
			},
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

	const recap = computePreviousMonthRecap(prevMonthExpenses, { year: prevYear, monthNum: prevMonthNum, payDate, now });
	const upcoming = computeUpcomingPayments(currentMonthExpenses, {
		year: currentYear,
		monthNum: currentMonthNum,
		payDate,
		now,
		limit: 6,
	});

	const expenseInsightsBase = {
		recap,
		upcoming,
		recapTips: computeRecapTips({
			recap,
			currentMonthExpenses,
			ctx: { year: currentYear, monthNum: currentMonthNum, payDate, now },
			forecasts,
			historyExpenses,
		}),
	};

	// Fetch all plans for this user
	const allPlansData: Record<string, typeof currentPlanData> = {};
	if (sessionUser && username) {
		try {
			const userId = await resolveUserId({ userId: sessionUser.id, username });
			const plans = await listBudgetPlansForUser({ userId, username });
			
			// Fetch data for all plans
			for (const plan of plans) {
				allPlansData[plan.id] = await processPlanData(plan.id);
			}
		} catch {
			// If we can't fetch all plans, just use the current one
			allPlansData[budgetPlanId] = currentPlanData;
		}
	} else {
		allPlansData[budgetPlanId] = currentPlanData;
	}

	// Determine whether each plan has income entries for every month in the selected year.
	// Used to hide the “Add income” shortcut when the year is already fully populated.
	const incomeMonthsCoverageByPlan: Record<string, number> = {};
	try {
		const planIds = Object.keys(allPlansData);
		if (planIds.length > 0) {
			const groups = await prisma.income.groupBy({
				by: ["budgetPlanId", "month"],
				where: {
					budgetPlanId: { in: planIds },
					year: selectedYear,
				},
			});
			for (const g of groups) {
				incomeMonthsCoverageByPlan[g.budgetPlanId] = (incomeMonthsCoverageByPlan[g.budgetPlanId] ?? 0) + 1;
			}
		}
	} catch {
		// Non-blocking
	}

	const allDebts = await prisma.debt.findMany({
		where: { budgetPlanId },
	});

	const serializedDebts = allDebts.map((d) => ({
		id: d.id,
		name: d.name,
		type: d.type,
		initialBalance: Number(d.initialBalance),
		currentBalance: Number(d.currentBalance),
		monthlyMinimum: d.monthlyMinimum == null ? undefined : Number(d.monthlyMinimum),
		interestRate: d.interestRate == null ? undefined : Number(d.interestRate),
		paid: d.paid,
		paidAmount: Number(d.paidAmount),
		amount: Number(d.amount),
		createdAt: d.createdAt.toISOString(),
		sourceType: d.sourceType === "expense" ? ("expense" as const) : undefined,
		sourceExpenseId: d.sourceExpenseId ?? undefined,
		sourceMonthKey: d.sourceMonthKey ?? undefined,
		sourceCategoryId: d.sourceCategoryId ?? undefined,
		sourceCategoryName: d.sourceCategoryName ?? undefined,
		sourceExpenseName: d.sourceExpenseName ?? undefined,
	}));
	
	const debts = serializedDebts.filter((d) => d.sourceType !== "expense");
	const debtTips = computeDebtTips({ debts, totalIncome: currentPlanData.totalIncome });
	const expenseInsights = {
		...expenseInsightsBase,
		recapTips: [...(expenseInsightsBase.recapTips ?? []), ...debtTips],
	};
	const totalDebtBalance = debts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<ViewTabs
					budgetPlanId={budgetPlanId}
					month={month}
					categoryData={currentPlanData.categoryData}
					regularExpenses={[]}
					totalIncome={currentPlanData.totalIncome}
					totalAllocations={currentPlanData.totalAllocations}
					plannedDebtPayments={currentPlanData.plannedDebtPayments}
					incomeAfterAllocations={currentPlanData.incomeAfterAllocations}
					totalExpenses={currentPlanData.totalExpenses}
					remaining={currentPlanData.remaining}
					debts={debts}
					totalDebtBalance={totalDebtBalance}
					goals={currentPlanData.goals}
					allPlansData={allPlansData}
					incomeMonthsCoverageByPlan={incomeMonthsCoverageByPlan}
					expenseInsights={expenseInsights}
				/>
			</div>
		</div>
	);
}
