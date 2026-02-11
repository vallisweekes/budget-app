import { MONTHS } from "@/lib/budget/engine";
import { getAllDebts } from "@/lib/debts/store";
import { getSpendingForMonth, getAllowanceStats } from "@/lib/spending/actions";
import { getSettings } from "@/lib/settings/store";
import SpendingTab from "@/app/components/SpendingTab";
import SpendingInsights from "@/app/components/SpendingInsights";
import SpendingCharts from "@/app/components/SpendingCharts";

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

export default async function SpendingPage() {
	const month = currentMonth();
	const debts = getAllDebts();
	const spending = await getSpendingForMonth(month);
	const allowanceStats = await getAllowanceStats(month);
	const settings = await getSettings();

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<h1 className="text-3xl font-bold text-white mb-2">Spending Tracker</h1>
				<p className="text-slate-400 mb-6">Log unplanned purchases and track where the money comes from</p>
				
				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/10">
						<div className="text-sm text-slate-400 mb-1">Monthly Allowance</div>
						<div className="text-2xl font-bold text-white">£{allowanceStats.monthlyAllowance.toFixed(2)}</div>
						<div className="text-xs text-slate-500 mt-1">
							Period: {allowanceStats.periodStart} - {allowanceStats.periodEnd}
						</div>
					</div>
					<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/10">
						<div className="text-sm text-slate-400 mb-1">Allowance Remaining</div>
						<div className={`text-2xl font-bold ${allowanceStats.remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
							£{allowanceStats.remaining.toFixed(2)}
						</div>
						<div className="text-xs text-slate-500 mt-1">
							{allowanceStats.percentUsed.toFixed(0)}% used
						</div>
					</div>
					<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/10">
						<div className="text-sm text-slate-400 mb-1">Savings Balance</div>
						<div className="text-2xl font-bold text-white">£{(settings.savingsBalance || 0).toFixed(2)}</div>
					</div>
				</div>

				{/* AI Insights */}
				{spending.length > 0 && (
					<div className="mb-8">
						<SpendingInsights 
							spending={spending} 
							allowanceStats={allowanceStats}
							savingsBalance={settings.savingsBalance || 0}
						/>
					</div>
				)}

				{/* Charts */}
				{spending.length > 0 && (
					<div className="mb-8">
						<SpendingCharts spending={spending} />
					</div>
				)}

				<SpendingTab month={month} debts={debts} spending={spending} />
			</div>
		</div>
	);
}
