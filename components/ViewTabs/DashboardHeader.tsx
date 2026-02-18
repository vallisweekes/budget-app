import Link from "next/link";
import { Plus } from "lucide-react";
import { monthDisplayLabel } from "@/lib/helpers/monthDisplayLabel";

export default function DashboardHeader(props: {
	month: string;
	expensesHref: string;
	incomeHref: string;
	shouldShowAddIncome: boolean;
	hasIncome: boolean;
}) {
	const { month, expensesHref, incomeHref, shouldShowAddIncome, hasIncome } = props;

	return (
		<>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="text-sm text-slate-300">{monthDisplayLabel(month as any)} snapshot</div>
					<div className="text-xl sm:text-2xl font-bold text-white">Dashboard</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Link
						href={expensesHref}
						className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
					>
						<Plus size={16} />
						Add expense
					</Link>
					{shouldShowAddIncome ? (
						<Link
							href={incomeHref}
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
						>
							<Plus size={16} />
							Add income
						</Link>
					) : null}
				</div>
			</div>

			{!hasIncome ? (
				<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<div className="text-sm font-semibold text-white">Add income to unlock your budget</div>
						<div className="text-xs sm:text-sm text-amber-100/80">
							No income added for {monthDisplayLabel(month as any)} yet — your totals and insights will be limited until you do.
						</div>
					</div>
					<Link
						href={incomeHref}
						className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
					>
						Add income
					</Link>
				</div>
			) : null}
		</>
	);
}
