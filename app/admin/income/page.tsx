import { getAllIncome } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey, formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import { addIncomeAction } from "./actions";
import { SelectDropdown } from "@/components/Shared";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MonthlyIncomeGrid } from "./MonthlyIncomeGrid";

export const dynamic = "force-dynamic"; // This line is now active

export default async function AdminIncomePage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");

	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const planParam = searchParams.plan;
	const planCandidate = Array.isArray(planParam) ? planParam[0] : planParam;
	const requestedPlanId = typeof planCandidate === "string" ? planCandidate : "";

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	if (!requestedPlanId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/income`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: requestedPlanId } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/income`);
	}

	const budgetPlanId = budgetPlan.id;
	const income = await getAllIncome(budgetPlanId);
	const nowMonth = currentMonthKey();

	const monthsWithoutIncome = MONTHS.filter((m) => (income[m]?.length ?? 0) === 0);
	const hasAvailableMonths = monthsWithoutIncome.length > 0;
	const defaultMonth: MonthKey =
		(monthsWithoutIncome.includes(nowMonth) ? nowMonth : monthsWithoutIncome[0]) || nowMonth;
	
	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-7xl px-4 py-8">
				<div className="mb-10">
					<h1 className="text-4xl font-bold text-white mb-2">Income</h1>
					<p className="text-slate-400 text-lg">Manage your income sources</p>
				</div>

				{hasAvailableMonths && (
					<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 mb-8">
						<div className="flex items-center gap-3 mb-8">
							<div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
								<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
								</svg>
							</div>
							<div>
								<h2 className="text-2xl font-bold text-white">Add Income</h2>
								<p className="text-slate-400 text-sm">Add a new income source for any month</p>
							</div>
						</div>
						<form action={addIncomeAction} className="grid grid-cols-1 md:grid-cols-12 gap-4">
							<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
							<label className="md:col-span-3">
								<span className="block text-sm font-medium text-slate-300 mb-2">Month</span>
								<SelectDropdown
									name="month"
									defaultValue={defaultMonth}
									options={monthsWithoutIncome.map((m) => ({ value: m, label: formatMonthKeyLabel(m) }))}
									buttonClassName="bg-slate-900/60 focus:ring-amber-500"
								/>
							</label>
							<label className="md:col-span-5">
								<span className="block text-sm font-medium text-slate-300 mb-2">Income Name</span>
								<input
									name="name"
									placeholder="e.g., Salary, Freelance Work"
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
								/>
							</label>
							<label className="md:col-span-3">
								<span className="block text-sm font-medium text-slate-300 mb-2">Amount (£)</span>
								<input
									name="amount"
									type="number"
									step="0.01"
									placeholder="0.00"
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
								/>
							</label>
							<div className="md:col-span-11 flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
								<label className="flex items-center gap-2 text-sm text-slate-300 select-none">
									<input
										type="checkbox"
										name="distributeMonths"
										className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-amber-500 focus:ring-amber-500"
									/>
									Distribute across all months
								</label>
								<label className="flex items-center gap-2 text-sm text-slate-300 select-none">
									<input
										type="checkbox"
										name="distributeYears"
										className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-amber-500 focus:ring-amber-500"
									/>
									Distribute across all years (all budgets)
								</label>
							</div>
							<div className="md:col-span-1 flex items-end">
								<button
									type="submit"
									className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
								>
									<span className="hidden md:inline">+</span>
									<span className="md:hidden">Add Income</span>
								</button>
							</div>
						</form>
					</div>
				)}

				<div className="space-y-6">
					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
							<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
								/>
							</svg>
						</div>
						<div>
							<h2 className="text-2xl font-bold text-white">Monthly Income</h2>
							<p className="text-slate-400 text-sm">Manage income sources for each month</p>
						</div>
					</div>

					<MonthlyIncomeGrid
						months={MONTHS}
						income={income}
						budgetPlanId={budgetPlanId}
					/>
				</div>
			</div>
		</div>
	);
}
