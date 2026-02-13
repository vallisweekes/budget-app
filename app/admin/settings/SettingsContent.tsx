"use client";

import { useState } from "react";
import { MONTHS } from "@/lib/constants/time";
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from "@/lib/constants/locales";
import { SelectDropdown } from "@/components/Shared";
import type { MonthKey } from "@/types";
import { CalendarDays, Lightbulb, PiggyBank, Wallet, Globe, User, AlertTriangle, Edit2 } from "lucide-react";
import { saveSettingsAction, updateUserDetailsAction } from "./actions";
import DeleteBudgetPlanButton from "./DeleteBudgetPlanButton";
import type { Settings } from "@/lib/settings/store";

type Section = "details" | "budget" | "locale" | "plans" | "danger";

interface SettingsContentProps {
	budgetPlanId: string;
	settings: Settings;
	sessionUser: { id?: string; name?: string | null; email?: string | null };
	monthSummary: any;
	fiftyThirtyTwenty: any;
	selectedMonth: MonthKey;
	allPlans?: Array<{ id: string; name: string; kind: string }>;
}

export default function SettingsContent({
	budgetPlanId,
	settings,
	sessionUser,
	monthSummary,
	fiftyThirtyTwenty,
	selectedMonth,
	allPlans = [],
}: SettingsContentProps) {
	const [activeSection, setActiveSection] = useState<Section>("details");
	const [isEditingEmail, setIsEditingEmail] = useState(false);

	const sections = [
		{
			id: "details" as Section,
			title: "My Details",
			description: "Your personal information",
			icon: User,
		},
		{
			id: "budget" as Section,
			title: "Budget",
			description: "Core settings for your monthly budgeting",
			icon: PiggyBank,
		},
		{
			id: "locale" as Section,
			title: "Locale",
			description: "Country, language, and currency preferences",
			icon: Globe,
		},
		{
			id: "plans" as Section,
			title: "Plans",
			description: "Manage your budget plans",
			icon: Wallet,
		},
		{
			id: "danger" as Section,
			title: "Danger Zone",
			description: "Irreversible actions",
			icon: AlertTriangle,
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
						<div className="lg:sticky lg:top-20 bg-slate-800/30 backdrop-blur-xl rounded-3xl border border-white/10 p-4">
							<nav className="space-y-1">
								{sections.map((s) => {
									const Icon = s.icon;
									return (
										<button
											key={s.id}
											onClick={() => setActiveSection(s.id)}
											className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 transition ${
												activeSection === s.id
													? "bg-blue-500/20 border-blue-500/50 text-white"
													: "text-slate-200 hover:bg-white/5 border-transparent hover:border-white/10"
											} border`}
										>
											<Icon className="w-4 h-4" />
											<div className="flex-1">
												<div className="text-sm font-semibold">{s.title}</div>
												<div className="text-xs text-slate-400">{s.description}</div>
											</div>
										</button>
									);
								})}
							</nav>
						</div>
					</aside>

					<main className="lg:col-span-9">
						{activeSection === "details" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">My Details</h2>
										<p className="text-slate-400 text-sm">Your personal information</p>
									</div>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
									<form action={updateUserDetailsAction} className="space-y-6">
										<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
											<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-400 text-lg">
												{sessionUser.name || "Not set"}
											</div>
											<p className="text-xs text-slate-500 mt-1">Name is set by your authentication provider</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
											<div className="relative">
												{isEditingEmail ? (
													<input
														name="email"
														type="email"
														defaultValue={sessionUser.email || ""}
														placeholder="your@email.com"
														className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 pr-12 text-white text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
													/>
												) : (
													<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 pr-12 text-white text-lg">
														{sessionUser.email || "Not set"}
													</div>
												)}
												<button
													type="button"
													onClick={() => setIsEditingEmail(!isEditingEmail)}
													className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors"
													aria-label={isEditingEmail ? "Cancel editing" : "Edit email"}
												>
													<Edit2 className="w-4 h-4 text-slate-400" />
												</button>
											</div>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Country</label>
											<SelectDropdown
												name="country"
												defaultValue={settings.country ?? "GB"}
												options={SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
												buttonClassName="bg-slate-900/60 focus:ring-blue-500"
											/>
										</div>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Details
										</button>
									</form>
								</div>
							</section>
						)}

						{activeSection === "budget" && (
							<section className="space-y-6">
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
											<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
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
											<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
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
											<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
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
											<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
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
													<p className="text-slate-400 text-sm">Assign every £ until leftover is £0.</p>
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
														<p className="text-slate-400 text-sm">
															Adjust Allowance / Savings / Investments until this is £0.
														</p>
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
													<p className="text-slate-400 text-sm mt-1">
														Actual (expenses): £{fiftyThirtyTwenty.needsActual.toFixed(2)}
													</p>
													<p className="text-slate-500 text-xs mt-1">
														Delta: £{(fiftyThirtyTwenty.needsActual - fiftyThirtyTwenty.needsTarget).toFixed(2)}
													</p>
												</div>
												<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
													<p className="text-slate-300 font-semibold">Wants (30%)</p>
													<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
													<p className="text-slate-400 text-sm mt-1">
														Actual (allowance): £{fiftyThirtyTwenty.wantsActual.toFixed(2)}
													</p>
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
														Prioritise savings/investments and debt payments, then spend what's left.
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
												<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
													Left after paying yourself first
												</p>
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
						)}

						{activeSection === "locale" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Locale</h2>
										<p className="text-slate-400 text-sm">Country, language, and currency preferences.</p>
									</div>
									<span className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-medium text-slate-200">
										Regional
									</span>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
											<Globe className="w-6 h-6 text-white" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white">Regional Settings</h3>
											<p className="text-slate-400 text-sm">Choose your country, language, and currency.</p>
										</div>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Country</span>
												<SelectDropdown
													name="country"
													defaultValue={settings.country ?? "GB"}
													options={SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Language</span>
												<SelectDropdown
													name="language"
													defaultValue={settings.language ?? "en"}
													options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Currency</span>
												<SelectDropdown
													name="currency"
													defaultValue={settings.currency ?? "GBP"}
													options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.name}` }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
										</div>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Locale Settings
										</button>
									</form>
								</div>
							</section>
						)}

						{activeSection === "plans" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Budget Plans</h2>
										<p className="text-slate-400 text-sm">Manage your budget plans (Personal, Holiday, Carnival)</p>
									</div>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
									<div className="space-y-4">
										{allPlans.map((plan) => (
											<div
												key={plan.id}
												className={`p-4 rounded-xl border transition-all ${
													plan.id === budgetPlanId
														? "bg-blue-500/10 border-blue-500/50"
														: "bg-slate-900/40 border-white/10 hover:border-white/20"
												}`}
											>
												<div className="flex items-center justify-between">
													<div>
														<h3 className="font-bold text-white capitalize">{plan.name}</h3>
														<p className="text-sm text-slate-400 capitalize">{plan.kind} Plan</p>
													</div>
													{plan.id === budgetPlanId && (
														<span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
															Current
														</span>
													)}
												</div>
											</div>
										))}
										
										{allPlans.length === 0 && (
											<div className="text-center py-8 text-slate-400">
												<p>No budget plans found. Create one to get started.</p>
											</div>
										)}
										
										{allPlans.length < 3 && (
											<a
												href={`/user=${encodeURIComponent(sessionUser.name || "")}/${encodeURIComponent(sessionUser.id || "")}/budgets/new`}
												className="block w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold text-center shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
											>
												+ Add New Plan
											</a>
										)}
									</div>
								</div>
							</section>
						)}

						{activeSection === "danger" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Danger Zone</h2>
										<p className="text-slate-400 text-sm">Actions here are permanent.</p>
									</div>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-red-500/20 p-8 hover:border-red-500/30 transition-all">
									<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
										<div>
											<h3 className="text-xl font-bold text-white">Delete this budget plan</h3>
											<p className="text-slate-400 text-sm mt-1">
												This permanently deletes the plan and all associated data.
											</p>
										</div>
										<DeleteBudgetPlanButton budgetPlanId={budgetPlanId} />
									</div>
								</div>
							</section>
						)}
					</main>
				</div>
			</div>
		</div>
	);
}
