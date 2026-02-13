import { MONTHS } from "@/lib/constants/time";
import { listBudgetPlansForUser, resolveUserId } from "@/lib/budgetPlans";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ViewTabs from "@/components/ViewTabs";
import { currentMonthKey } from "@/lib/helpers/monthKey";

export const dynamic = "force-dynamic";

function currentMonth(): typeof MONTHS[number] {
	return currentMonthKey();
}

export default async function DashboardView({ budgetPlanId }: { budgetPlanId: string }) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;

	// Function to process plan data
	const processPlanData = async (planId: string) => {
		const now = new Date();
		const defaultYear = now.getFullYear();
		const defaultMonthNum = now.getMonth() + 1; // 1-12

		const [latestExpense, latestIncome] = await Promise.all([
			prisma.expense.findFirst({
				where: { budgetPlanId: planId },
				orderBy: [{ year: "desc" }, { month: "desc" }],
				select: { year: true, month: true },
			}),
			prisma.income.findFirst({
				where: { budgetPlanId: planId },
				orderBy: [{ year: "desc" }, { month: "desc" }],
				select: { year: true, month: true },
			}),
		]);

		const candidates = [
			{ year: defaultYear, month: defaultMonthNum },
			latestExpense ? { year: latestExpense.year, month: latestExpense.month } : null,
			latestIncome ? { year: latestIncome.year, month: latestIncome.month } : null,
		].filter(Boolean) as Array<{ year: number; month: number }>;

		const { year: selectedYear, month: selectedMonthNum } = candidates.reduce((max, cur) => {
			if (cur.year > max.year) return cur;
			if (cur.year < max.year) return max;
			return cur.month > max.month ? cur : max;
		});
		
		// Fetch all data from database for this plan
		const [categories, expenses, income, goals] = await Promise.all([
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

		const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
		const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
		const remaining = totalIncome - totalExpenses;

		return {
			year: selectedYear,
			monthNum: selectedMonthNum,
			categoryData,
			totalIncome,
			totalExpenses,
			remaining,
			goals: serializedGoals,
		};
	};

	// Get current plan data
	const currentPlanData = await processPlanData(budgetPlanId);
	const month = MONTHS[currentPlanData.monthNum - 1] ?? currentMonth();

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

	// Fetch debts from database
	const allDebts = await prisma.debt.findMany({
		where: { budgetPlanId },
	});

	// Serialize debts into plain objects (convert Decimal/Date and nulls)
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
	const totalDebtBalance = debts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<ViewTabs
					budgetPlanId={budgetPlanId}
					month={month}
					categoryData={currentPlanData.categoryData}
					regularExpenses={[]}
					totalIncome={currentPlanData.totalIncome}
					totalExpenses={currentPlanData.totalExpenses}
					remaining={currentPlanData.remaining}
					debts={debts}
					totalDebtBalance={totalDebtBalance}
					goals={currentPlanData.goals}
					allPlansData={allPlansData}
				/>
				<div className="mt-8 text-xs text-zinc-500 text-center">Manage entries in /admin.</div>
			</div>
		</div>
	);
}
