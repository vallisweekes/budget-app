"use client";

import { useState, useTransition } from "react";
import type { MonthKey } from "@/types";
import { updateIncomeAction, removeIncomeAction, addIncomeAction } from "./actions";
import { Edit2, Trash2, Check, X, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";
import ConfirmModal from "@/components/ConfirmModal";

interface IncomeItem {
	id: string;
	name: string;
	amount: number;
}

interface IncomeManagerProps {
	budgetPlanId: string;
	month: MonthKey;
	incomeItems: IncomeItem[];
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function IncomeManager({ budgetPlanId, month, incomeItems }: IncomeManagerProps) {
	const [isPending, startTransition] = useTransition();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [incomePendingDelete, setIncomePendingDelete] = useState<IncomeItem | null>(null);
	const [editName, setEditName] = useState("");
	const [editAmount, setEditAmount] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [newName, setNewName] = useState("");
	const [newAmount, setNewAmount] = useState("");

	const handleEdit = (item: IncomeItem) => {
		setEditingId(item.id);
		setEditName(item.name);
		setEditAmount(item.amount.toString());
	};

	const handleSave = (id: string) => {
		const amount = parseFloat(editAmount);
		if (!editName.trim() || isNaN(amount)) return;

		startTransition(async () => {
			await updateIncomeAction(budgetPlanId, month, id, editName, amount);
			setEditingId(null);
		});
	};

	const handleCancel = () => {
		setEditingId(null);
		setEditName("");
		setEditAmount("");
	};

	const handleRemoveClick = (item: IncomeItem) => {
		setIncomePendingDelete(item);
	};

	const confirmRemove = () => {
		const item = incomePendingDelete;
		if (!item) return;
		startTransition(() => {
			removeIncomeAction(budgetPlanId, month, item.id);
		});
	};

	const handleAdd = () => {
		const amount = parseFloat(newAmount);
		if (!newName.trim() || isNaN(amount)) return;

		startTransition(async () => {
			const formData = new FormData();
			formData.append("budgetPlanId", budgetPlanId);
			formData.append("month", month);
			formData.append("name", newName);
			formData.append("amount", amount.toString());
			await addIncomeAction(formData);
			setIsAdding(false);
			setNewName("");
			setNewAmount("");
		});
	};

	const handleCancelAdd = () => {
		setIsAdding(false);
		setNewName("");
		setNewAmount("");
	};

	return (
		<div className="space-y-2">
			<ConfirmModal
				open={incomePendingDelete != null}
				title="Remove income entry?"
				description={
					incomePendingDelete
						? `This will permanently remove \"${incomePendingDelete.name}\".`
						: undefined
				}
				tone="danger"
				confirmText="Remove"
				cancelText="Keep"
				isBusy={isPending}
				onClose={() => {
					if (!isPending) setIncomePendingDelete(null);
				}}
				onConfirm={() => {
					confirmRemove();
					setIncomePendingDelete(null);
				}}
			/>
			{incomeItems.map((item) => {
				const isEditing = editingId === item.id;

				if (isEditing) {
					return (
						<div
							key={item.id}
							className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg border border-white/10"
						>
							<label className="flex-1">
								<span className="block text-xs font-medium text-slate-300 mb-1">Name</span>
								<input
									type="text"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
									placeholder="Name"
									aria-label="Income name"
								/>
							</label>
							<label className="w-28">
								<span className="block text-xs font-medium text-slate-300 mb-1">Amount</span>
								<input
									type="number"
									step="0.01"
									value={editAmount}
									onChange={(e) => setEditAmount(e.target.value)}
									className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
									placeholder="Amount"
									aria-label="Income amount"
								/>
							</label>
							<button
								onClick={() => handleSave(item.id)}
								disabled={isPending}
								className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
								title="Save"
							>
								<Check size={16} />
							</button>
							<button
								onClick={handleCancel}
								disabled={isPending}
								className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors"
								title="Cancel"
							>
								<X size={16} />
							</button>
						</div>
					);
				}

				return (
					<div
						key={item.id}
						className="flex items-center justify-between group hover:bg-slate-900/20 p-2 rounded-lg transition-colors"
					>
						<div className="flex items-center gap-3 flex-1">
							<div className="text-sm font-medium text-white">{item.name}</div>
							<div className="text-xs text-slate-400">
								<Currency value={item.amount} />
							</div>
						</div>
						<div className="flex gap-1 transition-opacity">
							<button
								onClick={() => handleEdit(item)}
								disabled={isPending}
								className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
								title="Edit"
							>
								<Edit2 size={14} />
							</button>
							<button
								onClick={() => handleRemoveClick(item)}
								disabled={isPending}
								className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
								title="Remove"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				);
			})}

			{isAdding ? (
				<div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg border border-white/10">
					<label className="flex-1">
						<span className="block text-xs font-medium text-slate-300 mb-1">Name</span>
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Income name"
							aria-label="New income name"
							autoFocus
						/>
					</label>
					<label className="w-28">
						<span className="block text-xs font-medium text-slate-300 mb-1">Amount</span>
						<input
							type="number"
							step="0.01"
							value={newAmount}
							onChange={(e) => setNewAmount(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Amount"
							aria-label="New income amount"
						/>
					</label>
					<button
						onClick={handleAdd}
						disabled={isPending}
						className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
						title="Add"
					>
						<Check size={16} />
					</button>
					<button
						onClick={handleCancelAdd}
						disabled={isPending}
						className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
						title="Cancel"
					>
						<X size={16} />
					</button>
				</div>
			) : (
				<button
					onClick={() => setIsAdding(true)}
					className="w-full flex items-center justify-center gap-2 p-2 text-sm text-purple-400 hover:bg-purple-500/10 rounded-lg border border-purple-500/20 transition-colors cursor-pointer"
				>
					<Plus size={16} />
					Add Income
				</button>
			)}
		</div>
	);
}
