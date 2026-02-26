"use client";

import { SelectDropdown } from "@/components/Shared";

interface Pot {
	id: string;
	name: string;
}

export default function SpendingAllowancePotFields({
	pots,
	selectedPotId,
	onSelectedPotIdChange,
}: {
	pots: Pot[];
	selectedPotId: string;
	onSelectedPotIdChange: (next: string) => void;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<label className="block">
				<span className="block text-sm font-medium text-slate-300 mb-1">Allowance Pot</span>
				<SelectDropdown
					name="potId"
					value={selectedPotId}
					onValueChange={onSelectedPotIdChange}
					placeholder={pots.length ? "Select a pot" : "Create your first pot"}
					options={[...pots.map((p) => ({ value: p.id, label: p.name })), { value: "__new__", label: "+ New pot" }]}
					buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
					menuClassName="rounded-xl"
				/>
			</label>

			{selectedPotId === "__new__" ? (
				<label className="block">
					<span className="block text-sm font-medium text-slate-300 mb-1">New pot name</span>
					<input
						name="newPotName"
						required
						placeholder="e.g., Jayda, Personal, Kids"
						className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-500"
					/>
				</label>
			) : null}
		</div>
	);
}
