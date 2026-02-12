import { getAllIncome } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import Link from "next/link";
import { ArrowRight, Settings as SettingsIcon } from "lucide-react";
import { addIncomeAction } from "./actions";
import IncomeManager from "./IncomeManager";

export const dynamic = "force-dynamic";

export default async function AdminIncomePage() {
	const income = await getAllIncome();
	const defaultMonth: MonthKey = "JANUARY";
	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-7xl px-4 py-8">
				<div className="mb-10">
					<h1 className="text-4xl font-bold text-white mb-2">Income</h1>
					<p className="text-slate-400 text-lg">Manage your income sources</p>
				</div>

				<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 mb-8 hover:border-white/20 transition-all">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
								<SettingsIcon className="w-6 h-6 text-white" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-white">Budget Settings</h2>
								<p className="text-slate-400 text-sm">Pay date, allowance and savings live in Settings now.</p>
							</div>
						</div>
						<Link
							href="/admin/settings#budget"
							className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
						>
							Open <ArrowRight className="w-4 h-4" />
						</Link>
					</div>
				</div>

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
						<label className="md:col-span-3">
							<span className="block text-sm font-medium text-slate-300 mb-2">Month</span>
							<select
								name="month"
								defaultValue={defaultMonth}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all cursor-pointer"
							>
								{MONTHS.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
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

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{MONTHS.map((m) => (
							<div
								key={m}
								className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-5 hover:border-white/20 transition-all"
							>
								<h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
									<span className="w-2 h-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full"></span>
									{m}
								</h3>
								<IncomeManager month={m as MonthKey} incomeItems={income[m]} />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
