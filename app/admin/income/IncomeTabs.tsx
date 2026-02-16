"use client";

import { useId, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type IncomeTabKey = "income" | "allocations";

export default function IncomeTabs(props: {
	initialTab?: IncomeTabKey;
	allocations: React.ReactNode;
	income: React.ReactNode;
}) {
	const tabsLabelId = useId();
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
					label: "Income sacrifice",
					description: "Amounts taken from income before budgeting",
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
			<div className="space-y-2">
				<span id={tabsLabelId} className="sr-only">
					Income tabs
				</span>
				<div
					role="tablist"
					aria-labelledby={tabsLabelId}
					className="inline-flex max-w-full rounded-full border border-white/10 bg-slate-900/35 backdrop-blur-xl shadow-lg p-1"
				>
					<div className="relative grid grid-cols-2">
						<div
							aria-hidden="true"
							className={`absolute inset-y-0 left-0 w-1/2 rounded-full border border-white/10 shadow-sm transition-transform duration-300 ease-out ${
								activeTab === "income"
									? "bg-gradient-to-r from-purple-500/35 to-indigo-500/25"
									: "bg-gradient-to-r from-emerald-500/30 to-teal-500/20 translate-x-full"
							}`}
						/>

						{tabs.map((t) => {
							const isActive = activeTab === t.key;
							return (
								<button
									key={t.key}
									type="button"
									onClick={() => setTab(t.key)}
									role="tab"
									aria-selected={isActive}
									className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
									isActive ? "text-white" : "text-slate-300 hover:text-white"
								}`}
							>
								{t.label}
							</button>
							);
						})}
					</div>
				</div>

				<div className="hidden sm:block text-xs text-slate-400">
					{tabs.find((t) => t.key === activeTab)?.description ?? ""}
				</div>
			</div>

			{activeTab === "income" ? props.income : props.allocations}
		</div>
	);
}
