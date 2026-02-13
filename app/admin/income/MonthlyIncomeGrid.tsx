"use client";

import { useState } from "react";
import type { MonthKey } from "@/types";
import { getAllIncome } from "@/lib/income/store";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import IncomeManager from "./IncomeManager";

interface MonthlyIncomeGridProps {
	months: readonly string[];
	income: Awaited<ReturnType<typeof getAllIncome>>;
	budgetPlanId: string;
}

export function MonthlyIncomeGrid({
	months,
	income,
	budgetPlanId,
}: MonthlyIncomeGridProps) {
	const [activeManager, setActiveManager] = useState<string | null>(null);

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{months.map((m) => (
				<div
					key={m}
					className={`bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-5 hover:border-white/20 transition-all flex flex-col ${
						activeManager === m ? "z-10 relative" : ""
					}`}
				>
					<h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 flex-shrink-0">
						<span className="w-2 h-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full"></span>
						{formatMonthKeyLabel(m as MonthKey)}
					</h3>
					<div className="flex-1 flex flex-col">
						<IncomeManager
							budgetPlanId={budgetPlanId}
							month={m as MonthKey}
							incomeItems={income[m as MonthKey]}
							onOpen={() => setActiveManager(m)}
							onClose={() => setActiveManager(null)}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
