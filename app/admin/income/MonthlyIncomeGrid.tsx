"use client";

import { useState } from "react";
import type { MonthKey } from "@/types";
import { getAllIncome } from "@/lib/income/store";
import { currentMonthKey, formatMonthKeyLabel, monthKeyToNumber } from "@/lib/helpers/monthKey";
import IncomeManager from "./IncomeManager";
import { formatCurrency } from "@/lib/helpers/money";

interface MonthlyIncomeGridProps {
	months: readonly string[];
	income: Awaited<ReturnType<typeof getAllIncome>>;
	budgetPlanId: string;
	year: number;
}

export function MonthlyIncomeGrid({
	months,
	income,
	budgetPlanId,
	year,
}: MonthlyIncomeGridProps) {
	const [activeManager, setActiveManager] = useState<string | null>(null);
	const now = new Date();
	const currentYear = now.getFullYear();
	const nowMonth = currentMonthKey(now);

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
			{months.map((m) => {
				const monthKey = m as MonthKey;
				const isCurrent = year === currentYear && monthKey === nowMonth;
				const isPast =
					year < currentYear || (year === currentYear && monthKeyToNumber(monthKey) < monthKeyToNumber(nowMonth));
				const isActive = activeManager === m;
				const items = income[monthKey] ?? [];
				const total = items.reduce((sum, item) => sum + (item?.amount ?? 0), 0);

				return (
					<div
						key={m}
						className={`backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-xl border p-3 sm:p-5 transition-all flex flex-col ${
							isActive
								? isCurrent
									? "z-10 relative ring-2 ring-teal-200/35"
									: "z-10 relative ring-2 ring-white/10"
								: ""
						} ${
							isCurrent
								? "bg-teal-500/25 border-teal-200/45 hover:border-teal-100/60 shadow-[0_18px_45px_rgba(20,184,166,0.10)]"
								: "bg-slate-800/40 border-white/10 hover:border-white/20"
						} ${isCurrent ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : ""}`}
					>
						<div className="mb-2 sm:mb-4 flex items-start justify-between gap-2 sm:gap-3 flex-shrink-0">
							<h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
								<span
									className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
										isCurrent
											? "bg-gradient-to-r from-teal-200 to-cyan-200"
											: "bg-gradient-to-r from-pink-500 to-rose-600"
									}`}
								/>
								{formatMonthKeyLabel(monthKey)}
								{isCurrent && (
									<span className="ml-1 rounded-full border border-teal-100/40 bg-teal-200/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-teal-50">
										Current
									</span>
								)}
								{isPast && !isCurrent && (
									<span className="ml-1 rounded-full border border-white/10 bg-slate-900/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-400">
										Past
									</span>
								)}
							</h3>
							<div className="text-right">
								<div
									className={`text-xs sm:text-sm font-semibold ${isCurrent ? "text-teal-50" : "text-slate-100"}`}
								>
									{formatCurrency(total)}
								</div>
								<div className="text-[10px] sm:text-[11px] text-slate-400">
									{items.length} source{items.length === 1 ? "" : "s"}
								</div>
							</div>
						</div>
						<div className="flex-1 flex flex-col">
							<IncomeManager
								budgetPlanId={budgetPlanId}
								year={year}
								month={monthKey}
								incomeItems={items}
								onOpen={() => setActiveManager(m)}
								onClose={() => setActiveManager(null)}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
