"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeIncomeAction } from "./actions";
import { ConfirmModal } from "@/components/Shared";
import type { MonthKey } from "@/types";
import { useRouter } from "next/navigation";

interface DeleteIncomeButtonProps {
	id: string;
	budgetPlanId: string;
	year: number;
	month: MonthKey;
}

export default function DeleteIncomeButton({
	id,
	budgetPlanId,
	year,
	month,
}: DeleteIncomeButtonProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isOpen, setIsOpen] = useState(false);

	const handleDelete = () => {
		startTransition(async () => {
			await removeIncomeAction(budgetPlanId, year, month, id);
			setIsOpen(false);
			router.refresh();
		});
	};

	return (
		<>
			<button
				onClick={() => setIsOpen(true)}
				disabled={isPending}
				className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
				aria-label="Delete income"
			>
				<Trash2 className="w-3 h-3" />
			</button>
			<ConfirmModal
				open={isOpen}
				title="Delete Income"
				description="Are you sure you want to delete this income source? This action cannot be undone."
				tone="danger"
				isBusy={isPending}
				onConfirm={handleDelete}
				onClose={() => setIsOpen(false)}
			/>
		</>
	);
}
