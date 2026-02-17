"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/Shared/ConfirmModal";
import { SelectDropdown } from "@/components/Shared";
import { createGoal } from "@/lib/goals/actions";

type GoalType = "yearly" | "long-term";
type GoalCategory = "debt" | "savings" | "emergency" | "investment" | "other";

export default function AddGoalModal({
	budgetPlanId,
	minYear,
	maxYear,
	defaultYear,
}: {
	budgetPlanId: string;
	minYear: number;
	maxYear: number;
	defaultYear: number;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [type, setType] = useState<GoalType>("yearly");
	const [category, setCategory] = useState<GoalCategory>("debt");
	const [targetAmount, setTargetAmount] = useState("");
	const [currentAmount, setCurrentAmount] = useState("");
	const [targetYear, setTargetYear] = useState("");
	const [description, setDescription] = useState("");

	const canSubmit = useMemo(() => Boolean(budgetPlanId && title.trim()), [budgetPlanId, title]);

	function resetForm() {
		setTitle("");
		setType("yearly");
		setCategory("debt");
		setTargetAmount("");
		setCurrentAmount("");
		setTargetYear(String(defaultYear));
		setDescription("");
		setError(null);
	}

	return (
		<>
			<div className="flex items-center justify-between gap-3 sm:gap-4">
				<div>
					<h2 className="text-base sm:text-xl font-bold text-white">Goals</h2>
					<p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
						Add goals to keep your plan on track.
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						resetForm();
						setOpen(true);
					}}
					className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
				>
					<Plus className="h-4 w-4" />
					Add goal
				</button>
			</div>

			<ConfirmModal
				open={open}
				title="Add a goal"
				description="Set a target and track your progress over time."
				confirmText="Add goal"
				cancelText="Cancel"
				tone="default"
				isBusy={isPending}
				confirmDisabled={!canSubmit}
				onClose={() => {
					if (isPending) return;
					setOpen(false);
				}}
				onConfirm={() => {
					startTransition(async () => {
						setError(null);
						try {
								const yearTrimmed = targetYear.trim();
								if (yearTrimmed) {
									const parsed = Number.parseInt(yearTrimmed, 10);
									if (Number.isNaN(parsed)) {
										setError("Please enter a valid target year.");
										return;
									}
									if (parsed < minYear || parsed > maxYear) {
										setError(`Target year must be between ${minYear} and ${maxYear}.`);
										return;
									}
								}

							const formData = new FormData();
							formData.append("budgetPlanId", budgetPlanId);
							formData.append("title", title.trim());
							formData.append("type", type);
							formData.append("category", category);
							if (targetAmount.trim()) formData.append("targetAmount", targetAmount.trim());
							if (currentAmount.trim()) formData.append("currentAmount", currentAmount.trim());
								if (yearTrimmed) formData.append("targetYear", yearTrimmed);
							if (description.trim()) formData.append("description", description.trim());

							await createGoal(formData);
							setOpen(false);
							router.refresh();
						} catch (e) {
							const message =
								e instanceof Error && e.message
									? e.message
									: "Unable to add goal. Please try again.";
							setError(message);
						}
					});
				}}
			>
				<div className="space-y-3">
					<label className="block">
						<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Goal title</span>
						<input
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
							placeholder="e.g., Pay off debt"
						/>
					</label>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="block">
							<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Goal type</span>
							<SelectDropdown
								value={type}
								onValueChange={(v) => setType(v as GoalType)}
								options={[
										{ value: "yearly", label: "Yearly" },
										{ value: "long-term", label: "Long-term" },
								]}
								buttonClassName="focus:ring-purple-500 text-xs sm:text-sm"
							/>
						</label>

						<label className="block">
							<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Category</span>
							<SelectDropdown
								value={category}
								onValueChange={(v) => setCategory(v as GoalCategory)}
								options={[
									{ value: "debt", label: "Debt" },
									{ value: "savings", label: "Savings" },
									{ value: "emergency", label: "Emergency" },
									{ value: "investment", label: "Investment" },
									{ value: "other", label: "Other" },
								]}
								buttonClassName="focus:ring-purple-500 text-xs sm:text-sm"
							/>
						</label>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="block">
							<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Target amount (£)</span>
							<input
								value={targetAmount}
								onChange={(e) => setTargetAmount(e.target.value)}
								type="number"
								step="0.01"
								className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
								placeholder="Optional"
							/>
						</label>
						<label className="block">
							<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Current amount (£)</span>
							<input
								value={currentAmount}
								onChange={(e) => setCurrentAmount(e.target.value)}
								type="number"
								step="0.01"
								className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
								placeholder="Optional"
							/>
						</label>
					</div>

					<label className="block">
						<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Target year</span>
						<input
							value={targetYear}
							onChange={(e) => setTargetYear(e.target.value)}
							type="number"
							min={minYear}
							max={maxYear}
							className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
							placeholder={`${minYear}–${maxYear}`}
						/>
						<p className="text-[11px] text-slate-400 mt-1">Choose a year within your budget horizon ({minYear}–{maxYear}).</p>
					</label>

					<label className="block">
						<span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Description</span>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={2}
							className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none text-xs sm:text-sm"
							placeholder="Optional notes"
						/>
					</label>

					{error ? (
						<p className="text-sm text-red-200" role="alert">
							{error}
						</p>
					) : null}
				</div>
			</ConfirmModal>
		</>
	);
}
