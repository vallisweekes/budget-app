import { MONTHS } from "../lib/budget/engine";
import { getAllExpenses } from "../lib/expenses/store";
import { getAllIncome } from "../lib/income/store";
import { getCategories } from "../lib/categories/store";
import { getAllDebts, getTotalDebtBalance } from "../lib/debts/store";
import { getAllGoals } from "../lib/goals/store";
import Card from "../components/Card";
import CategoryIcon from "../components/CategoryIcon";
import ViewTabs from "../components/ViewTabs";

export const dynamic = "force-dynamic";

function Currency({ value }: { value: number }) {
	return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

function currentMonth(): typeof MONTHS[number] {
	const now = new Date();
	const mIdx = now.getMonth(); // 0 Jan
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

export default async function HomePage() {
	const month = currentMonth();
	const expenses = await getAllExpenses();
	const income = await getAllIncome();
	const categories = await getCategories();
	const debts = getAllDebts();
	const totalDebtBalance = getTotalDebtBalance();
	const goals = getAllGoals();
	const monthExpenses = expenses[month];
	const monthIncome = income[month];
	
	// Create category lookup
	const categoryLookup = categories.reduce((acc, cat) => {
		acc[cat.id] = cat;
		return acc;
	}, {} as Record<string, typeof categories[0]>);
	
	// All expenses are now regular expenses (no special savings/investment handling)
	const regularExpenses = monthExpenses;
	
	// Group expenses by category
	const categoryTotals = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
		}
		return acc;
	}, {} as Record<string, number>);
	
	// Group expenses by category with full expense details
	const expensesByCategory = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			if (!acc[e.categoryId]) {
				acc[e.categoryId] = [];
			}
			acc[e.categoryId].push(e);
		}
		return acc;
	}, {} as Record<string, typeof regularExpenses>);
	
	// Create array of categories with totals, sorted by amount
	const categoryData = Object.entries(categoryTotals)
		.map(([catId, total]) => ({
			...categoryLookup[catId],
			total,
			expenses: expensesByCategory[catId] || [],
		}))
		.filter(c => c.name) // Remove undefined categories
		.sort((a, b) => b.total - a.total);
	
	const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<ViewTabs
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
