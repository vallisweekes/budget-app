import Link from "next/link";
import { getSettings } from "@/lib/settings/store";
import { saveSettingsAction } from "./actions";
import { getBudgetMonthSummary, isMonthKey } from "@/lib/budget/zero-based";
import { MONTHS } from "@/lib/constants/time";
import { SelectDropdown } from "@/components/Shared";
import type { MonthKey } from "@/types";
import { ArrowRight, CalendarDays, Lightbulb, PiggyBank, Tags, Wallet } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	const settings = await getSettings();
	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const planParam = searchParams.plan;
	const planCandidate = Array.isArray(planParam) ? planParam[0] : planParam;
	let budgetPlanId = typeof planCandidate === "string" ? planCandidate : "";
	budgetPlanId = budgetPlanId.trim();

	if (!budgetPlanId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallback.id)}/settings#budget`);
	}

	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, userId: true } });
	if (!plan || plan.userId !== userId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallback.id)}/settings#budget`);
	}

	budgetPlanId = plan.id;
	const monthParam = searchParams.month;
	const monthCandidate = Array.isArray(monthParam) ? monthParam[0] : monthParam;
	const selectedMonth: MonthKey =
		typeof monthCandidate === "string" && isMonthKey(monthCandidate) ? (monthCandidate as MonthKey) : "JANUARY";
	const monthSummary = settings.budgetStrategy && budgetPlanId ? await getBudgetMonthSummary(budgetPlanId, selectedMonth) : null;
	const fiftyThirtyTwenty =
		settings.budgetStrategy === "fiftyThirtyTwenty" && monthSummary
			? {
				needsTarget: monthSummary.incomeTotal * 0.5,
				wantsTarget: monthSummary.incomeTotal * 0.3,
				savingsDebtTarget: monthSummary.incomeTotal * 0.2,
				// Approximations for “where your money is going” based on existing data model
				needsActual: monthSummary.expenseTotal,
				wantsActual: monthSummary.plannedAllowance,
				savingsDebtActual:
					monthSummary.plannedSavings +
					monthSummary.plannedInvestments +
					monthSummary.debtPaymentsTotal,
			}
			: null;

	const sections = [
		{
			id: "budget",
			title: "Budget",
			description: "Core settings for your monthly budgeting.",
		},
		{
			id: "organization",
			title: "Organization",
			description: "Structure how you group and track spending.",
		},
		{
			id: "more",
			title: "More",
			description: "Reserved space for future settings.",
		},
	];

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-7xl px-4 py-8">
				<div className="mb-10">
					<h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
					<p className="text-slate-400 text-lg">Configure your budget and app options</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					<aside className="lg:col-span-3">
						<div className="lg:sticky lg:top-6 bg-slate-800/30 backdrop-blur-xl rounded-3xl border border-white/10 p-4">
							<p className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-2 pb-2">Sections</p>
							<nav className="space-y-1">
								{sections.map((s) => (
									<a
										key={s.id}
										href={`#${s.id}`}
										className="block rounded-xl px-3 py-2 text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/10 transition"
									>
										<div className="text-sm font-semibold">{s.title}</div>
										<div className="text-xs text-slate-400">{s.description}</div>
									</a>
								))}
							</nav>
						</div>
					</aside>

					<main className="lg:col-span-9 space-y-10">
						<section id="budget" className="scroll-mt-24">
							<div className="flex items-center justify-between gap-4 mb-5">
								<div>
									<h2 className="text-2xl font-bold text-white">Budget</h2>
									<p className="text-slate-400 text-sm">Pay date, allocations, and budgeting style.</p>
								</div>
								<span className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-medium text-slate-200">
									Core
								</span>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
											<CalendarDays className="w-6 h-6 text-white" />
										</div>
										<h3 className="text-xl font-bold text-white">Pay Date</h3>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Day of Month</span>
											<input
												name="payDate"
												type="number"
												min={1}
												max={31}
												defaultValue={settings.payDate}
												className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
											/>
										</label>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Pay Date
										</button>
									</form>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
											<Wallet className="w-6 h-6 text-white" />
										</div>
										<h3 className="text-xl font-bold text-white">Allocations</h3>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Monthly Allowance (£)</span>
											<input
												name="monthlyAllowance"
												type="number"
												step="0.01"
												defaultValue={settings.monthlyAllowance ?? 0}
												className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
											/>
										</label>
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Monthly Savings (£)</span>
											<input
												name="monthlySavingsContribution"
												type="number"
												step="0.01"
												defaultValue={settings.monthlySavingsContribution ?? 0}
												className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
											/>
										</label>
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Monthly Investments (£)</span>
											<input
												name="monthlyInvestmentContribution"
												type="number"
												step="0.01"
												defaultValue={settings.monthlyInvestmentContribution ?? 0}
												className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
											/>
										</label>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Allocations
										</button>
									</form>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
											<PiggyBank className="w-6 h-6 text-white" />
										</div>
										<h3 className="text-xl font-bold text-white">Savings Balance</h3>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Current Balance (£)</span>
											<input
												name="savingsBalance"
												type="number"
												step="0.01"
												defaultValue={settings.savingsBalance ?? 0}
												className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
											/>
										</label>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Balance
										</button>
									</form>
								</div>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
											<Lightbulb className="w-6 h-6 text-white" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white">Budget Strategy</h3>
											<p className="text-slate-400 text-sm">Optional. Turn on features like zero-based budgeting.</p>
										</div>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<label className="block">
											<span className="text-sm font-medium text-slate-400 mb-2 block">Strategy</span>
												<SelectDropdown
													name="budgetStrategy"
													defaultValue={settings.budgetStrategy ?? ""}
													options={[
														{ value: "", label: "None" },
														{ value: "zeroBased", label: "Zero-based budgeting (ZBB)" },
														{ value: "fiftyThirtyTwenty", label: "50/30/20 rule" },
														{ value: "payYourselfFirst", label: "Pay yourself first" },
													]}
													buttonClassName="bg-slate-900/60 focus:ring-pink-500"
												/>
										</label>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Strategy
										</button>
									</form>
								</div>

								{settings.budgetStrategy === "zeroBased" && monthSummary && (
									<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
										<div className="flex items-start justify-between gap-4 mb-6">
											<div>
												<h3 className="text-xl font-bold text-white">Zero-based leftover</h3>
												<p className="text-slate-400 text-sm">
													Assign every £ until leftover is £0.
												</p>
											</div>
											<form method="get" className="flex items-end gap-2">
												<label className="block">
													<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
												</label>
												<button
													type="submit"
													className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
												>
													View
												</button>
											</form>
										</div>

										<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
											<div className="flex items-center justify-between gap-4">
												<div>
													<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Leftover to allocate</p>
													<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
												</div>
												<div className="text-right">
													<p className="text-slate-300 text-sm font-semibold">Tip</p>
													<p className="text-slate-400 text-sm">Adjust Allowance / Savings / Investments until this is £0.</p>
												</div>
											</div>
											<p className="text-xs text-slate-500 mt-3">
												Leftover = Income − Expenses − Debt Payments − Allowance − Savings − Investments
											</p>
										</div>

										<div className="grid grid-cols-2 gap-3 text-sm">
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Income</p>
												<p className="text-white font-bold">£{monthSummary.incomeTotal.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Expenses</p>
												<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Debt payments</p>
												<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Spending (tracked)</p>
												<p className="text-white font-bold">£{monthSummary.spendingTotal.toFixed(2)}</p>
											</div>
										</div>
									</div>
								)}

								{settings.budgetStrategy === "fiftyThirtyTwenty" && monthSummary && fiftyThirtyTwenty && (
									<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
										<div className="flex items-start justify-between gap-4 mb-6">
											<div>
												<h3 className="text-xl font-bold text-white">50/30/20 targets</h3>
												<p className="text-slate-400 text-sm">Simple guideline based on your income for the month.</p>
											</div>
											<form method="get" className="flex items-end gap-2">
												<label className="block">
													<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
												</label>
												<button
													type="submit"
													className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
												>
													View
												</button>
											</form>
										</div>

										<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
											<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Income used for targets</p>
											<p className="text-2xl font-extrabold text-white mt-1">£{monthSummary.incomeTotal.toFixed(2)}</p>
											<p className="text-xs text-slate-500 mt-2">
												Needs and wants are approximations until category tagging is added.
											</p>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
												<p className="text-slate-300 font-semibold">Needs (50%)</p>
												<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.needsTarget.toFixed(2)}</p>
												<p className="text-slate-400 text-sm mt-1">Actual (expenses): £{fiftyThirtyTwenty.needsActual.toFixed(2)}</p>
												<p className="text-slate-500 text-xs mt-1">
													Delta: £{(fiftyThirtyTwenty.needsActual - fiftyThirtyTwenty.needsTarget).toFixed(2)}
												</p>
											</div>
											<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
												<p className="text-slate-300 font-semibold">Wants (30%)</p>
												<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
												<p className="text-slate-400 text-sm mt-1">Actual (allowance): £{fiftyThirtyTwenty.wantsActual.toFixed(2)}</p>
												<p className="text-slate-500 text-xs mt-1">
													Delta: £{(fiftyThirtyTwenty.wantsActual - fiftyThirtyTwenty.wantsTarget).toFixed(2)}
												</p>
											</div>
											<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
												<p className="text-slate-300 font-semibold">Savings/Debt (20%)</p>
												<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.savingsDebtTarget.toFixed(2)}</p>
												<p className="text-slate-400 text-sm mt-1">
													Actual (savings + investments + debt): £{fiftyThirtyTwenty.savingsDebtActual.toFixed(2)}
												</p>
												<p className="text-slate-500 text-xs mt-1">
													Delta: £{(fiftyThirtyTwenty.savingsDebtActual - fiftyThirtyTwenty.savingsDebtTarget).toFixed(2)}
												</p>
											</div>
										</div>
									</div>
								)}

								{settings.budgetStrategy === "payYourselfFirst" && monthSummary && (
									<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
										<div className="flex items-start justify-between gap-4 mb-6">
											<div>
												<h3 className="text-xl font-bold text-white">Pay yourself first</h3>
												<p className="text-slate-400 text-sm">
													Prioritise savings/investments and debt payments, then spend what’s left.
												</p>
											</div>
											<form method="get" className="flex items-end gap-2">
												<label className="block">
													<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
												</label>
												<button
													type="submit"
													className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
												>
													View
												</button>
											</form>
										</div>

										<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
											<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Left after paying yourself first</p>
											<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
											<p className="text-slate-400 text-sm mt-2">
												Increase Savings/Investments if you want to prioritise future goals.
											</p>
										</div>

										<div className="grid grid-cols-2 gap-3 text-sm">
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Savings (planned)</p>
												<p className="text-white font-bold">£{monthSummary.plannedSavings.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Investments (planned)</p>
												<p className="text-white font-bold">£{monthSummary.plannedInvestments.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Debt payments</p>
												<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
											</div>
											<div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
												<p className="text-slate-400">Expenses</p>
												<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
											</div>
										</div>
									</div>
								)}
							</div>
						</section>

						<section id="organization" className="scroll-mt-24">
							<div className="flex items-center justify-between gap-4 mb-5">
								<div>
									<h2 className="text-2xl font-bold text-white">Organization</h2>
									<p className="text-slate-400 text-sm">Manage categories and grouping options.</p>
								</div>
							</div>

							<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
								<div className="flex items-center justify-between gap-4">
									<div className="flex items-center gap-3">
										<div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
											<Tags className="w-6 h-6 text-white" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white">Categories</h3>
											<p className="text-slate-400 text-sm">Create, hide, and delete expense categories.</p>
										</div>
									</div>
									<Link
										href="/admin/categories"
										className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
									>
										Open <ArrowRight className="w-4 h-4" />
									</Link>
								</div>
							</div>
						</section>

						<section id="more" className="scroll-mt-24">
							<h2 className="text-2xl font-bold text-white mb-2">More</h2>
							<p className="text-slate-400 text-sm mb-5">Add new sections here as the app grows.</p>
							<div className="bg-slate-800/30 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
								<p className="text-slate-300 font-semibold">Coming soon</p>
								<p className="text-slate-500 text-sm mt-1">
									Ideas: currency/locale, rounding rules, export/import, display preferences.
								</p>
							</div>
						</section>
					</main>
				</div>
			</div>
		</div>
	);
}
