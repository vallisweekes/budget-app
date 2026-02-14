"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUpAZ, DollarSign } from "lucide-react";
import DebtCard from "./DebtCard";
import type { DebtPayment } from "@/types";

interface Debt {
	id: string;
	name: string;
	type: string;
	initialBalance: number;
	currentBalance: number;
	amount: number;
	monthlyMinimum?: number;
	interestRate?: number;
}

interface DebtsListProps {
	debts: Debt[];
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	paymentsMap: Map<string, DebtPayment[]>;
	payDate: number;
}

type SortOption = "manual" | "name" | "amount";

export default function DebtsList({ debts, budgetPlanId, typeLabels, paymentsMap, payDate }: DebtsListProps) {
	const [sortBy, setSortBy] = useState<SortOption>("manual");
	const [manualOrder, setManualOrder] = useState<string[]>(debts.map(d => d.id));
	const [draggedId, setDraggedId] = useState<string | null>(null);

	// Sort debts based on current sort option
	const sortedDebts = useMemo(() => {
		const sorted = [...debts];
		
		if (sortBy === "name") {
			sorted.sort((a, b) => a.name.localeCompare(b.name));
		} else if (sortBy === "amount") {
			sorted.sort((a, b) => b.currentBalance - a.currentBalance);
		} else if (sortBy === "manual") {
			// Sort by manual order
			sorted.sort((a, b) => {
				const indexA = manualOrder.indexOf(a.id);
				const indexB = manualOrder.indexOf(b.id);
				// If not in manual order, put at end
				if (indexA === -1) return 1;
				if (indexB === -1) return -1;
				return indexA - indexB;
			});
		}
		
		return sorted;
	}, [debts, sortBy, manualOrder]);

	const handleDragStart = (e: React.DragEvent, debtId: string) => {
		setDraggedId(debtId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		
		if (!draggedId || draggedId === targetId) {
			setDraggedId(null);
			return;
		}

		// Update manual order
		const newOrder = [...manualOrder.filter(id => debts.some(d => d.id === id))];
		const draggedIndex = newOrder.indexOf(draggedId);
		const targetIndex = newOrder.indexOf(targetId);

		if (draggedIndex !== -1) {
			newOrder.splice(draggedIndex, 1);
		}
		
		if (targetIndex !== -1) {
			newOrder.splice(targetIndex, 0, draggedId);
		} else {
			newOrder.push(draggedId);
		}

		setManualOrder(newOrder);
		setDraggedId(null);
		
		// Switch to manual sort mode when user drags
		if (sortBy !== "manual") {
			setSortBy("manual");
		}
	};

	const handleDragEnd = () => {
		setDraggedId(null);
	};

	if (debts.length === 0) {
		return (
			<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/10">
				<div className="text-6xl mb-4">🎉</div>
				<h3 className="text-xl font-semibold text-white mb-2">No Debts!</h3>
				<p className="text-slate-400">You have no tracked debts at the moment.</p>
			</div>
		);
	}

	return (
		<>
			{/* Sort Controls */}
			<div className="flex items-center gap-3 mb-4">
				<span className="text-sm text-slate-400">Sort by:</span>
				<div className="flex gap-2">
					<button
						onClick={() => setSortBy("manual")}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
							sortBy === "manual"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<ArrowUpDown className="w-4 h-4" />
						Manual
					</button>
					<button
						onClick={() => setSortBy("name")}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
							sortBy === "name"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<ArrowUpAZ className="w-4 h-4" />
						Name
					</button>
					<button
						onClick={() => setSortBy("amount")}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
							sortBy === "amount"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<DollarSign className="w-4 h-4" />
						Amount
					</button>
				</div>
				{sortBy === "manual" && (
					<span className="text-xs text-slate-500 ml-2">
						Drag to reorder
					</span>
				)}
			</div>

			{/* Debts List */}
			<div className="space-y-4">
				{sortedDebts.map((debt) => (
					<div
						key={debt.id}
						draggable={sortBy === "manual"}
						onDragStart={(e) => handleDragStart(e, debt.id)}
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, debt.id)}
						onDragEnd={handleDragEnd}
						className={`transition-all ${
							sortBy === "manual" ? "cursor-move" : ""
						} ${
							draggedId === debt.id ? "opacity-50 scale-95" : ""
						}`}
					>
						<DebtCard
							debt={debt}
							budgetPlanId={budgetPlanId}
							typeLabels={typeLabels}
							payments={paymentsMap.get(debt.id) || []}
							payDate={payDate}
						/>
					</div>
				))}
			</div>
		</>
	);
}
