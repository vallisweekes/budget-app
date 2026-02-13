import { MONTHS } from "@/lib/constants/time";
import { getAllExpenses } from "@/lib/expenses/store";
import { getAllIncome } from "@/lib/income/store";
import { getAllDebts } from "@/lib/debts/store";
import { getAllGoals } from "@/lib/goals/store";
import { listBudgetPlansForUser, resolveUserId } from "@/lib/budgetPlans";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ViewTabs from "@/components/ViewTabs";

export const dynamic = "force-dynamic";

function currentMonth(): typeof MONTHS[number] {
	const now = new Date();
	const mIdx = now.getMonth();
	const map: Record<number, typeof MONTHS[number]> = {
		0: "JANUARY",
		1: "FEBURARY",
		2: "MARCH",
		3: "APRIL",
		4: "MAY",
		5: "JUNE",
		6: "JULY",
		7: "AUGUST ",
		8: "SEPTEMBER",
		9: "OCTOBER",
		10: "NOVEMBER",
		11: "DECEMBER",
	};
	return map[mIdx];
}

export default async function DashboardView({ budgetPlanId }: { budgetPlanId: string }) {
	const month = currentMonth();
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;

	// Function to process plan data
	const processPlanData = async (planId: string) => {
		// Fetch categories for this specific plan from database
		const categories = await prisma.category.findMany({
			where: { budgetPlanId: planId },
		});
		
		const categoryLookup = categories.reduce((acc, cat) => {
			acc[cat.id] = cat;
			return acc;
		}, {} as Record<string, typeof categories[number]>);

		const expenses = await getAllExpenses(planId);
		const income = await getAllIncome(planId);
		const goals = getAllGoals(planId);
		const monthExpenses = expenses[month];
		const monthIncome = income[month];

		const regularExpenses = monthExpenses;

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
				total,
				expenses: expensesByCategory[catId] || [],
			}))
			.filter((c) => c.name)
			.sort((a, b) => b.total - a.total);

		const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
		const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
		const remaining = totalIncome - totalExpenses;

		return {
			categoryData,
			totalIncome,
			totalExpenses,
			remaining,
			goals,
		};
	};

	// Get current plan data
	const currentPlanData = await processPlanData(budgetPlanId);

	// Fetch all plans for this user
	let allPlansData: Record<string, typeof currentPlanData> = {};
	if (sessionUser && username) {
		try {
			const userId = await resolveUserId({ userId: sessionUser.id, username });
			const plans = await listBudgetPlansForUser({ userId, username });
			
			// Fetch data for all plans
			for (const plan of plans) {
				allPlansData[plan.id] = await processPlanData(plan.id);
			}
		} catch (error) {
			// If we can't fetch all plans, just use the current one
			allPlansData[budgetPlanId] = currentPlanData;
		}
	} else {
		allPlansData[budgetPlanId] = currentPlanData;
	}

	const debts = (await getAllDebts(budgetPlanId)).filter((d) => d.sourceType !== "expense");
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
