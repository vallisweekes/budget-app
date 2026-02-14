import { getAllIncome } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey, formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import { isMonthKey } from "@/lib/budget/zero-based";
import { addIncomeAction, saveAllocationsAction } from "./actions";
import { SelectDropdown } from "@/components/Shared";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MonthlyIncomeGrid } from "./MonthlyIncomeGrid";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import SaveFeedbackBanner from "./SaveFeedbackBanner";
import { formatCurrency } from "@/lib/helpers/money";
import Link from "next/link";
import IncomeTabs from "./IncomeTabs";
import AllocationsMonthSaveRow from "./AllocationsMonthSaveRow";

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

	const allocMonthParam = searchParams.month;
	const allocMonthCandidate = Array.isArray(allocMonthParam) ? allocMonthParam[0] : allocMonthParam;
	const allocMonth: MonthKey = isMonthKey(String(allocMonthCandidate ?? ""))
		? (String(allocMonthCandidate) as MonthKey)
		: nowMonth;
	const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, allocMonth);
	const customAllocations = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, allocMonth, { year: allocation.year });

	const monthlyAllocationSummaries = await Promise.all(
		MONTHS.map(async (m) => {
			const alloc = await getMonthlyAllocationSnapshot(budgetPlanId, m);
			const custom = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, m, { year: alloc.year });
			const grossIncome = (income[m] ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
			const fixedTotal =
				(alloc.monthlyAllowance ?? 0) +
				(alloc.monthlySavingsContribution ?? 0) +
				(alloc.monthlyEmergencyContribution ?? 0) +
				(alloc.monthlyInvestmentContribution ?? 0);
			const customTotal = custom.total ?? 0;
			const total = fixedTotal + customTotal;
			return {
				month: m,
				year: alloc.year,
				grossIncome,
				fixedTotal,
				customTotal,
				total,
				leftToBudget: grossIncome - total,
				customCount: custom.items.length,
			};
		})
	);

	const grossIncomeForAllocMonth = (income[allocMonth] ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
	const fixedAllocationsForAllocMonth =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0);
	const totalAllocationsForAllocMonth = fixedAllocationsForAllocMonth + (customAllocations.total ?? 0);
	const remainingToBudgetForAllocMonth = grossIncomeForAllocMonth - totalAllocationsForAllocMonth;

	const monthsWithoutIncome = MONTHS.filter((m) => (income[m]?.length ?? 0) === 0);
	const hasAvailableMonths = monthsWithoutIncome.length > 0;
	const defaultMonth: MonthKey =
		(monthsWithoutIncome.includes(nowMonth) ? nowMonth : monthsWithoutIncome[0]) || nowMonth;

	const tabParam = searchParams.tab;
	const tabCandidate = Array.isArray(tabParam) ? tabParam[0] : tabParam;
	const initialTab = tabCandidate === "allocations" || tabCandidate === "income" ? tabCandidate : "income";

	const allocationsView = (
			<div className="space-y-8">
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
							<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22m7-17H5m12 4H7m8 4H9" />
							</svg>
						</div>
						<div>
							<h2 className="text-2xl font-bold text-white">Allocations</h2>
							<p className="text-slate-400 text-sm">Set your month’s pre-budget costs, then budget what’s left.</p>
						</div>
					</div>
					<SaveFeedbackBanner
						kind="allocations"
						message="Allocations don’t change your Salary amounts — they reduce what’s left to budget for the selected month."
					/>
					<form id="allocations-form" action={saveAllocationsAction} className="grid grid-cols-1 md:grid-cols-12 gap-4">
						<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
						<AllocationsMonthSaveRow
							formId="allocations-form"
							month={allocMonth}
							year={allocation.year}
							isOverride={allocation.isOverride}
						/>

						<div className="md:col-span-12 mt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
							<label>
								<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Allowance (£)</span>
								<input
									name="monthlyAllowance"
									type="number"
									step="0.01"
									defaultValue={allocation.monthlyAllowance ?? 0}
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
								/>
							</label>
							<label>
								<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Savings (£)</span>
								<input
									name="monthlySavingsContribution"
									type="number"
									step="0.01"
									defaultValue={allocation.monthlySavingsContribution ?? 0}
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
								/>
							</label>
							<label>
								<span className="block text-sm font-medium text-slate-300 mb-2">Emergency Fund (£)</span>
								<input
									name="monthlyEmergencyContribution"
									type="number"
									step="0.01"
									defaultValue={allocation.monthlyEmergencyContribution ?? 0}
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
								/>
							</label>
							<label>
								<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Investments (£)</span>
								<input
									name="monthlyInvestmentContribution"
									type="number"
									step="0.01"
									defaultValue={allocation.monthlyInvestmentContribution ?? 0}
									className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
								/>
							</label>
						</div>

						<div className="md:col-span-12 mt-2">
							<div className="rounded-2xl border border-white/10 bg-slate-900/20 px-5 py-4">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-sm font-semibold text-white">Custom allocations</div>
										<div className="text-xs text-slate-400">Add any pre-budget items you want to track.</div>
									</div>
									<div className="text-xs text-slate-400">Total: {formatCurrency(customAllocations.total ?? 0)}</div>
								</div>

								{customAllocations.items.length === 0 ? (
									<div className="mt-3 rounded-xl border border-dashed border-white/10 bg-slate-900/10 px-4 py-3 text-sm text-slate-300">
										No custom allocations yet.
									</div>
								) : (
									<div className="mt-4 grid grid-cols-1 gap-4">
										{customAllocations.items.map((item) => (
											<label key={item.id} className="block">
												<span className="block text-sm font-medium text-slate-300 mb-2">
													{item.name}
													{item.isOverride ? (
														<span className="ml-2 text-xs text-amber-200">(custom for this month)</span>
													) : null}
												</span>
												<input
													name={`customAllocation:${item.id}`}
													type="number"
													step="0.01"
													defaultValue={item.amount ?? 0}
													className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
												/>
											</label>
										))}
									</div>
								)}

								<div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4">
									<label className="md:col-span-7">
										<span className="block text-sm font-medium text-slate-300 mb-2">New allocation name</span>
										<input
											name="newCustomAllocationName"
											placeholder="e.g., Tithe, Childcare, Pension"
											className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
										/>
									</label>
									<label className="md:col-span-5">
										<span className="block text-sm font-medium text-slate-300 mb-2">Default amount (£)</span>
										<input
											name="newCustomAllocationAmount"
											type="number"
											step="0.01"
											placeholder="0.00"
											className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
										/>
									</label>
								</div>
							</div>
						</div>
					</form>

					<div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
							<div className="text-xs text-slate-400">Gross income ({formatMonthKeyLabel(allocMonth)})</div>
							<div className="mt-1 text-xl font-bold text-white">{formatCurrency(grossIncomeForAllocMonth)}</div>
						</div>
						<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
							<div className="text-xs text-slate-400">Total allocations</div>
							<div className="mt-1 text-xl font-bold text-white">{formatCurrency(totalAllocationsForAllocMonth)}</div>
							<div className="mt-1 text-xs text-slate-400">Fixed + custom allocations</div>
						</div>
						<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
							<div className="text-xs text-slate-400">Left to budget</div>
							<div
								className={`mt-1 text-xl font-bold ${
									remainingToBudgetForAllocMonth < 0 ? "text-red-200" : "text-emerald-200"
								}`}
							>
								{formatCurrency(remainingToBudgetForAllocMonth)}
							</div>
							{remainingToBudgetForAllocMonth < 0 && (
								<div className="mt-1 text-xs text-red-200">
									Allocations exceed income by {formatCurrency(Math.abs(remainingToBudgetForAllocMonth))}
								</div>
							)}
						</div>
					</div>

					<div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/20 px-5 py-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-sm font-semibold text-white">Monthly allocations summary</div>
								<div className="text-xs text-slate-400">Quick view for Feb/Mar/etc. Click a month to edit details.</div>
							</div>
							<div className="text-xs text-slate-400">Year {allocation.year}</div>
						</div>

						<div className="mt-4 overflow-x-auto">
							<table className="min-w-full text-sm">
								<thead>
									<tr className="text-left text-slate-300">
										<th className="py-2 pr-4 font-medium">Month</th>
										<th className="py-2 pr-4 font-medium">Gross</th>
										<th className="py-2 pr-4 font-medium">Fixed</th>
										<th className="py-2 pr-4 font-medium">Custom</th>
										<th className="py-2 pr-4 font-medium">Total</th>
										<th className="py-2 pr-4 font-medium">Left</th>
										<th className="py-2 pr-4 font-medium">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{monthlyAllocationSummaries.map((row) => (
										<tr key={row.month} className={row.month === allocMonth ? "bg-emerald-500/5" : undefined}>
											<td className="py-3 pr-4 text-white">
												<div className="font-medium">{formatMonthKeyLabel(row.month)}</div>
												<div className="text-xs text-slate-400">{row.customCount} custom</div>
											</td>
											<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.grossIncome)}</td>
											<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.fixedTotal)}</td>
											<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.customTotal)}</td>
											<td className="py-3 pr-4 text-white font-semibold">{formatCurrency(row.total)}</td>
											<td className={`py-3 pr-4 ${row.leftToBudget < 0 ? "text-red-200" : "text-emerald-200"}`}>
												{formatCurrency(row.leftToBudget)}
											</td>
											<td className="py-3 pr-4">
												<Link
													href={`?tab=allocations&month=${encodeURIComponent(row.month)}`}
													className="inline-flex items-center rounded-lg border border-white/10 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900/60 transition"
												>
													{row.month === allocMonth ? "Viewing" : "View / edit"}
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		);

	const incomeView = (
			<div className="space-y-8">
				{hasAvailableMonths ? (
					<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
						<div className="flex items-center gap-3 mb-8">
							<div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
								<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
								</svg>
							</div>
							<div>
								<h2 className="text-2xl font-bold text-white">Add Income</h2>
								<p className="text-slate-400 text-sm">Only shows months that don’t have income yet.</p>
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
									Add
								</button>
							</div>
						</form>
					</div>
				) : (
					<div className="rounded-3xl border border-white/10 bg-slate-800/30 px-6 py-5">
						<div className="text-sm font-semibold text-slate-200">All months already have income</div>
						<div className="mt-1 text-sm text-slate-400">Edit current/future months below. Past months are read-only.</div>
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

					<MonthlyIncomeGrid months={MONTHS} income={income} budgetPlanId={budgetPlanId} />
				</div>
			</div>
		);

		return (
			<div className="min-h-screen pb-20 app-theme-bg">
				<div className="mx-auto w-full max-w-7xl px-4 py-8">
					<div className="mb-10">
						<h1 className="text-4xl font-bold text-white mb-2">Income</h1>
						<p className="text-slate-400 text-lg">Manage your income sources</p>
					</div>

					<IncomeTabs initialTab={initialTab} allocations={allocationsView} income={incomeView} />
				</div>
			</div>
		);
}
