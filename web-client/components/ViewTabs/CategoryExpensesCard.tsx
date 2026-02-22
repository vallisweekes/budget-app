import Link from "next/link";
import { Card } from "@/components/Shared";
import PieCategories from "@/components/PieCategories";

export default function CategoryExpensesCard(props: {
	topCategories: Array<{ name: string; total: number }>;
	expensesHref: string;
}) {
	const { topCategories, expensesHref } = props;

	return (
		<Card title={undefined} className="lg:col-span-7">
			<div className="space-y-3">
				<div className="inline-flex">
					<div className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900" style={{ backgroundColor: "#9EDBFF" }}>
						Category expenses
					</div>
				</div>
				{topCategories.length === 0 ? (
					<div className="text-sm text-slate-300">No categorized spend yet for this month.</div>
				) : (
					<PieCategories items={topCategories.map((c) => ({ name: c.name, amount: c.total }))} />
				)}

				<div className="flex items-center justify-between">
					<div className="text-xs text-slate-400">Shows top 6 by spend</div>
					<Link href={expensesHref} className="text-sm font-medium text-white/90 hover:text-white">
						View expenses
					</Link>
				</div>
			</div>
		</Card>
	);
}
