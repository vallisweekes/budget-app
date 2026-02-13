import { MONTHS } from "@/lib/constants/time";
import { getAllDebts } from "@/lib/debts/store";
import { getSpendingForMonth, getAllowanceStats } from "@/lib/spending/actions";
import { getSettings } from "@/lib/settings/store";
import SpendingTab from "@/components/SpendingTab";
import SpendingInsights from "@/components/SpendingInsights";
import SpendingCharts from "@/components/SpendingCharts";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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

export default async function SpendingPage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");

	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const planParam = searchParams.plan;
	const planCandidate = Array.isArray(planParam) ? planParam[0] : planParam;
	let requestedPlanId = typeof planCandidate === "string" ? planCandidate.trim() : "";
	if (requestedPlanId === "undefined" || requestedPlanId === "null") requestedPlanId = "";

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	if (!requestedPlanId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/spending`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: requestedPlanId } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/spending`);
	}

	const budgetPlanId = budgetPlan.id;
	if (!budgetPlanId) redirect("/budgets/new");
	const month = currentMonth();
	const debts = (await getAllDebts(budgetPlanId)).filter((d) => d.sourceType !== "expense");
	const spending = await getSpendingForMonth(month);
	const allowanceStats = await getAllowanceStats(month, budgetPlanId);
	const settings = await getSettings(budgetPlanId);

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

				<SpendingTab budgetPlanId={budgetPlanId} month={month} debts={debts} spending={spending} />
			</div>
		</div>
	);
}
