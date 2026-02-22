"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { ConfirmModal, useToast } from "@/components/Shared";
import { undoDebtPaymentFromForm } from "@/lib/debts/actions";
import { formatCurrency } from "@/lib/helpers/money";
import type { DebtPayment } from "@/types";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardRecentPayments(props: {
	payments: DebtPayment[];
	budgetPlanId: string;
	paymentMonth: string;
	debtName?: string;
}) {
	const { payments, budgetPlanId, paymentMonth, debtName } = props;
	const toast = useToast();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const hasPayments = payments.length > 0;
	const latestPayment = hasPayments ? payments[payments.length - 1] : undefined;
	const latestPaymentId = latestPayment?.id;
	const canUndoLatest = Boolean(latestPaymentId && latestPayment?.month === paymentMonth);
	const confirmPayment = canUndoLatest ? latestPayment : undefined;
	const hasAnyUndoableInView = payments.some((p) => p.month === paymentMonth);

	const confirmDescription = useMemo(() => {
		if (!confirmPayment) return "";
		const prettyAmount = formatCurrency(confirmPayment.amount);
		return (
			`Undoing this will increase ${debtName ? `“${debtName}”` : "the debt"} by ${prettyAmount}. ` +
			"If it was paid with a card, the card balance will go back down by the same amount. " +
			"You can only undo payments in the same month they were made."
		);
	}, [confirmPayment, debtName]);

	if (!hasPayments) return null;

	return (
		<div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
			<div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
				<div className="text-[10px] sm:text-xs text-slate-400">Recent Payments</div>
				{hasAnyUndoableInView ? (
					<div className="text-[10px] sm:text-xs text-slate-500">Undo available until month end</div>
				) : null}
			</div>
			<div className="space-y-0.5 sm:space-y-1">
				{payments
					.slice(-3)
					.reverse()
					.map((payment) => (
						(() => {
							const isCurrentMonth = payment.month === paymentMonth;
							const isLatest = payment.id === latestPaymentId;
							const showUndo = isCurrentMonth;
							const canUndoThis = showUndo && isLatest;

							return (
						<div
							key={payment.id}
							className="flex items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm"
						>
							<div className="flex items-center gap-2 min-w-0">
								<span className="text-slate-400 truncate">
									{new Date(payment.date).toLocaleDateString()}
									{payment.source ? (
										<span className="ml-2 text-xs text-slate-500">
											(
												{payment.source === "extra_funds"
													? "extra funds"
													: payment.source === "credit_card"
														? "card"
														: "income"}
											)
										</span>
									) : null}
								</span>

								{showUndo ? (
									<button
										type="button"
										onClick={() => {
											if (!canUndoThis) {
												toast.info("Undo newer payments first.");
												return;
											}
											setConfirmOpen(true);
										}}
										className={`grid h-7 w-7 place-items-center rounded-lg border border-white/10 transition-colors ${
											canUndoThis
												? "bg-slate-900/40 text-slate-200 hover:bg-slate-900/60"
												: "bg-slate-950/20 text-slate-500"
										}`}
										aria-label={canUndoThis ? "Undo payment" : "Undo payment (unavailable)"}
										aria-disabled={!canUndoThis}
										title={
											canUndoThis
												? "Undo (this month only)"
												: "Undo newer payments first"
										}
									>
										<RotateCcw className="h-3.5 w-3.5" />
									</button>
								) : null}
							</div>

							<span className="font-semibold text-emerald-400 whitespace-nowrap">
								-<Currency value={payment.amount} />
							</span>
						</div>
							);
						})()
					))}
			</div>

			<ConfirmModal
				open={confirmOpen}
				title="Undo payment?"
				description={confirmDescription}
				confirmText="Undo payment"
				cancelText="Keep payment"
				tone="danger"
				isBusy={isPending}
				onClose={() => setConfirmOpen(false)}
				onConfirm={() => {
					if (!confirmPayment) return;
					startTransition(async () => {
						try {
							const fd = new FormData();
							fd.set("budgetPlanId", budgetPlanId);
							fd.set("debtId", confirmPayment.debtId);
							fd.set("paymentId", confirmPayment.id);
							await undoDebtPaymentFromForm(fd);
							setConfirmOpen(false);
							toast.success("Payment undone.");
							router.refresh();
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Could not undo payment.");
							console.error("Undo payment failed:", err);
						}
					});
				}}
			/>
		</div>
	);
}
