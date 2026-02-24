"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/Shared";
import { deleteBudgetPlanAction, getBudgetPlanDeleteImpactAction } from "@/lib/settings/actions";

export default function DeleteBudgetPlanButton({
	budgetPlanId,
	planName,
	planKind,
	variant = "default",
	confirmMode = "type",
}: {
	budgetPlanId: string;
	planName?: string;
	planKind?: string;
	variant?: "default" | "icon";
	confirmMode?: "type" | "confirm";
}) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [typed, setTyped] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [impact, setImpact] = useState<null | {
		plan: { id: string; name: string; kind: string };
		counts: { categories: number; expenses: number; income: number; debts: number; goals: number };
	}>(null);
	const [isPending, startTransition] = useTransition();
	const confirmDisabled = useMemo(
		() => (confirmMode === "type" ? typed.trim() !== "DELETE" : false),
		[typed, confirmMode]
	);
	const effectiveKind = String(impact?.plan.kind ?? planKind ?? "").toLowerCase();
	const effectiveName = String(impact?.plan.name ?? planName ?? "this plan");
	const hasSpendingData = Boolean(
		impact &&
		(impact.counts.expenses > 0 || impact.counts.income > 0 || impact.counts.debts > 0 || impact.counts.goals > 0)
	);
	const shouldWarn = (effectiveKind === "holiday" || effectiveKind === "carnival") && hasSpendingData;

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setError(null);
					setTyped("");
					setImpact(null);
					setIsOpen(true);
					startTransition(async () => {
						try {
							const nextImpact = await getBudgetPlanDeleteImpactAction(budgetPlanId);
							setImpact(nextImpact);
						} catch {
							// Non-blocking: user can still proceed with static copy.
						}
					});
				}}
				className={
					variant === "icon"
						? "inline-flex items-center justify-center rounded-lg border border-red-500/25 bg-red-950/10 p-2 text-red-100 hover:bg-red-950/20 hover:border-red-400/40 transition"
						: "inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-950/30 hover:border-red-400/40 transition"
				}
				aria-label={variant === "icon" ? "Delete budget plan" : undefined}
			>
				<Trash2 className="h-4 w-4" />
				{variant === "icon" ? null : "Delete budget plan"}
			</button>

			<DeleteConfirmModal
				open={isOpen}
				title="Delete budget plan?"
				description={
					confirmMode === "type"
						? "This is permanent and cannot be undone. To confirm, type DELETE."
						: "This is permanent and cannot be undone."
				}
				confirmText="Delete"
				cancelText="Cancel"
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
							const confirmation = confirmMode === "type" ? typed.trim() : "DELETE";
							const result = await deleteBudgetPlanAction(budgetPlanId, confirmation);
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
				{shouldWarn ? (
					<div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
						<div className="text-xs font-semibold uppercase tracking-wider text-amber-200">
							Warning: linked spending data
						</div>
						<div className="mt-1 text-sm text-amber-100">
							You’re about to delete <span className="font-semibold">{effectiveName}</span> ({effectiveKind} plan).
							 This will remove its spending history and it may change your totals.
						</div>
						{impact ? (
							<div className="mt-2 text-xs text-amber-100/90">
								Includes: {impact.counts.expenses} expenses, {impact.counts.income} income entries, {impact.counts.debts} debts, {impact.counts.goals} goals.
							</div>
						) : null}
					</div>
				) : null}

				{confirmMode === "type" ? (
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
				) : null}
				{error && (
					<p className="mt-3 text-sm text-red-200" role="alert">
						{error}
					</p>
				)}
				<p className="mt-2 text-xs text-slate-400">
					This will delete all categories, income, expenses, debts, goals, and stored files for this plan.
				</p>
			</DeleteConfirmModal>
		</>
	);
}
