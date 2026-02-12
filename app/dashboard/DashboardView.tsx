import { MONTHS } from "@/lib/constants/time";
import { getAllExpenses } from "@/lib/expenses/store";
import { getAllIncome } from "@/lib/income/store";
import { getCategories } from "@/lib/categories/store";
import { getAllDebts } from "@/lib/debts/store";
import { getAllGoals } from "@/lib/goals/store";
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
	const expenses = await getAllExpenses(budgetPlanId);
	const income = await getAllIncome(budgetPlanId);
	const categories = await getCategories();
	const debts = (await getAllDebts(budgetPlanId)).filter((d) => d.sourceType !== "expense");
	const totalDebtBalance = debts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);
	const goals = getAllGoals(budgetPlanId);
	const monthExpenses = expenses[month];
	const monthIncome = income[month];

	const categoryLookup = categories.reduce((acc, cat) => {
		acc[cat.id] = cat;
		return acc;
	}, {} as Record<string, (typeof categories)[number]>);

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

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<ViewTabs
					budgetPlanId={budgetPlanId}
					month={month}
					categoryData={categoryData}
					regularExpenses={regularExpenses}
					totalIncome={totalIncome}
					totalExpenses={totalExpenses}
					remaining={remaining}
					debts={debts}
					totalDebtBalance={totalDebtBalance}
					goals={goals}
				/>
				<div className="mt-8 text-xs text-zinc-500 text-center">Manage entries in /admin.</div>
			</div>
		</div>
	);
}
