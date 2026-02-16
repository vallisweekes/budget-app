"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type IncomeTabKey = "income" | "allocations";

export default function IncomeTabs(props: {
	initialTab?: IncomeTabKey;
	allocations: React.ReactNode;
	income: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlTab = (searchParams.get("tab") ?? "") as IncomeTabKey;
	const activeTab = useMemo<IncomeTabKey>(() => {
		if (urlTab === "allocations" || urlTab === "income") return urlTab;
		return props.initialTab ?? "income";
	}, [props.initialTab, urlTab]);

	const tabs = useMemo(
		() =>
			[
				{
					key: "income" as const,
					label: "Income",
					description: "Add and edit monthly income sources",
				},
				{
					key: "allocations" as const,
					label: "Allocations",
					description: "Pre-budget costs and custom allocations",
				},
			],
		[]
	);

	const setTab = (tab: IncomeTabKey) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", tab);
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="bg-slate-800/35 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 p-2 sm:p-3">
				<div className="grid grid-cols-2 gap-2">
					{tabs.map((t) => {
						const isActive = activeTab === t.key;
						return (
							<button
								key={t.key}
								type="button"
								onClick={() => setTab(t.key)}
								className={`rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2 sm:py-3 text-left transition ${
									isActive
										? "bg-emerald-500/15 border-emerald-300/30"
										: "bg-slate-900/20 border-white/10 hover:bg-white/5"
								}`}
								aria-pressed={isActive}
							>
								<div className="flex items-center justify-between gap-3">
									<div className={`text-xs sm:text-sm font-semibold ${isActive ? "text-white" : "text-slate-200"}`}>{t.label}</div>
									{isActive ? (
										<span className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-50">
											Active
										</span>
									) : null}
								</div>
								<div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 hidden sm:block">{t.description}</div>
							</button>
						);
					})}
				</div>
			</div>

			{activeTab === "income" ? props.income : props.allocations}
		</div>
	);
}
