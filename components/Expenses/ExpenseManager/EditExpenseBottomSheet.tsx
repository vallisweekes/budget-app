import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { MonthKey } from "@/types";
import { MONTHS } from "@/lib/constants/time";
import { getDueDateUtc } from "@/lib/helpers/expenses/dueDate";
import type { ExpenseCategoryOption, EditExpenseModalProps } from "@/types/expenses-manager";
import EditExpenseFields from "@/components/Expenses/ExpenseManager/EditExpenseFields";
import EditExpenseApplyScope from "@/components/Expenses/ExpenseManager/EditExpenseApplyScope";

function asIsoDate(value: string | undefined): string {
	if (!value) return "";
	return value.length >= 10 ? value.slice(0, 10) : value;
}

export default function EditExpenseBottomSheet({
	open,
	budgetPlanId,
	month,
	year,
	payDate,
	categories,
	expense,
	isBusy,
	onClose,
	onSubmit,
}: EditExpenseModalProps) {
	const [name, setName] = useState("");
	const [amount, setAmount] = useState<string>("");
	const [categoryId, setCategoryId] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [isAllocation, setIsAllocation] = useState(false);
	const [applyRemainingMonths, setApplyRemainingMonths] = useState(false);
	const [applyFutureYears, setApplyFutureYears] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const closeTimeout = useRef<NodeJS.Timeout | null>(null);

	const monthNumber = useMemo(() => (MONTHS as MonthKey[]).indexOf(month) + 1, [month]);

	useEffect(() => {
		if (!expense) return;
		setName(expense.name);
		setAmount(String(expense.amount));
		setCategoryId(expense.categoryId ?? "");
		setIsAllocation(Boolean(expense.isAllocation));
		setApplyRemainingMonths(false);
		setApplyFutureYears(false);

		const rawDue = asIsoDate(expense.dueDate);
		if (rawDue) {
			setDueDate(rawDue);
			return;
		}
		const defaultDueUtc = getDueDateUtc({ year, monthNumber, payDate });
		setDueDate(defaultDueUtc.toISOString().slice(0, 10));
	}, [expense, monthNumber, payDate, year]);




	// Animation end handler
	const handleAnimationEnd = () => {
		if (isClosing) {
			setIsClosing(false);
		}
	};

	// Custom close handler
	const handleClose = () => {
		setIsClosing(true);
		closeTimeout.current = setTimeout(() => {
			setIsClosing(false);
			onClose();
		}, 300); // match animation duration
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (closeTimeout.current) clearTimeout(closeTimeout.current);
		};
	}, []);

	return (
		<>
			{(open || isClosing) && (
				<div className="fixed inset-x-0 bottom-0 z-[999] flex items-end justify-center pointer-events-auto">
					<div
						role="dialog"
						aria-modal="true"
						className={`relative z-50 w-full max-w-xl max-h-screen h-screen overflow-y-auto border border-white/10 bg-slate-800/50 backdrop-blur-xl shadow-2xl safe-area-inset-bottom ${isClosing ? "animate-slide-down" : "animate-slide-up"}`}
						onAnimationEnd={handleAnimationEnd}
					>
				   <div className="p-6 pb-8 md:pb-6">
						<div className="flex items-center justify-between gap-4 mb-4">
							<button
								type="button"
								onClick={() => {
									if (!isBusy) handleClose();
								}}
								className="h-10 px-4 rounded-xl border border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60 transition-all disabled:opacity-50"
								disabled={isBusy}
							>
								Cancel
							</button>
						</div>

					   <form
						   onSubmit={(e) => {
							   e.preventDefault();
							   onSubmit(new FormData(e.currentTarget));
						   }}
						   className="space-y-5"
					   >
						<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
						<input type="hidden" name="month" value={month} />
						<input type="hidden" name="year" value={year} />
						<input type="hidden" name="id" value={expense.id} />

						<EditExpenseFields
							categories={categories}
							name={name}
							onNameChange={setName}
							amount={amount}
							onAmountChange={setAmount}
							categoryId={categoryId}
							onCategoryIdChange={setCategoryId}
							dueDate={dueDate}
							onDueDateChange={setDueDate}
							isAllocation={isAllocation}
							onIsAllocationChange={setIsAllocation}
						/>

						<EditExpenseApplyScope
							applyRemainingMonths={applyRemainingMonths}
							setApplyRemainingMonths={(next) => {
								setApplyRemainingMonths(next);
								if (!next) setApplyFutureYears(false);
							}}
							applyFutureYears={applyFutureYears}
							setApplyFutureYears={(next) => {
								setApplyFutureYears(next);
								if (next) setApplyRemainingMonths(true);
							}}
						/>

						   <div className="flex items-center justify-center pt-6">
							   <button
								   type="submit"
								   disabled={isBusy}
								   className="h-10 px-6 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] disabled:opacity-50"
							   >
								   {isBusy ? "Saving…" : "Save changes"}
							   </button>
						   </div>
					</form>
				</div>
					</div>
				</div>
			)}
		</>
	);
}

// Add this to your global CSS:
// .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
// @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
