"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/Shared";
import { deleteBudgetPlanAction } from "./actions";

export default function DeleteBudgetPlanButton({
	budgetPlanId,
}: {
	budgetPlanId: string;
}) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [typed, setTyped] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const confirmDisabled = useMemo(() => typed.trim() !== "DELETE", [typed]);

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setError(null);
					setTyped("");
					setIsOpen(true);
				}}
				className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-950/30 hover:border-red-400/40 transition"
			>
				<Trash2 className="h-4 w-4" />
				Delete budget plan
			</button>

			<ConfirmModal
				open={isOpen}
				title="Delete budget plan?"
				description="This is permanent and cannot be undone. To confirm, type DELETE."
				confirmText="Delete"
				cancelText="Cancel"
				tone="danger"
				isBusy={isPending}
				confirmDisabled={confirmDisabled}
				onClose={() => {
					if (isPending) return;
					setIsOpen(false);
				}}
				onConfirm={() => {
					startTransition(async () => {
						setError(null);
						try {
							const result = await deleteBudgetPlanAction(budgetPlanId, typed.trim());
							setIsOpen(false);
							router.push(result.redirectTo);
							router.refresh();
						} catch (e) {
							const message =
								e instanceof Error && e.message
									? e.message
									: "Unable to delete this budget plan. Please try again.";
							setError(message);
						}
					});
				}}
			>
				<label className="block">
					<span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
						Type DELETE to confirm
					</span>
					<input
						autoFocus
						value={typed}
						onChange={(e) => {
							setTyped(e.target.value);
							if (error) setError(null);
						}}
						placeholder="DELETE"
						className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
					/>
				</label>
				{error && (
					<p className="mt-3 text-sm text-red-200" role="alert">
						{error}
					</p>
				)}
				<p className="mt-2 text-xs text-slate-400">
					This will delete all categories, income, expenses, debts, goals, and stored files for this plan.
				</p>
			</ConfirmModal>
		</>
	);
}
