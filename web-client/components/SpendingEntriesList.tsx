"use client";

type SpendingEntryBase = {
	id: string;
	description: string;
	amount: number;
	source: "card" | "savings" | "allowance";
	potId?: string;
};

interface Pot {
	id: string;
	name: string;
}

export default function SpendingEntriesList<T extends SpendingEntryBase>({
	spending,
	pots,
	isPending,
	onRemoveClick,
}: {
	spending: T[];
	pots: Pot[];
	isPending: boolean;
	onRemoveClick: (entry: T) => void;
}) {
	return (
		<ul className="space-y-2">
			{spending.length === 0 ? <li className="text-slate-400">No spending logged yet.</li> : null}
			{spending.map((entry) => (
				<li key={entry.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3">
					<div>
						<div className="text-white font-medium">{entry.description}</div>
						<div className="text-xs text-slate-400">
							£{entry.amount.toLocaleString()} • {entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}
							{entry.source === "allowance" && entry.potId
								? ` • ${pots.find((p) => p.id === entry.potId)?.name ?? "Pot"}`
								: ""}
						</div>
					</div>
					<button
						onClick={() => onRemoveClick(entry)}
						disabled={isPending}
						className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
						title="Delete"
					>
						Remove
					</button>
				</li>
			))}
		</ul>
	);
}
