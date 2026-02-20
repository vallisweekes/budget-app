"use client";

import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "@/types/components/debts";
import DebtCardAmountsGrid from "./DebtCardAmountsGrid";
import DebtCardInstallmentSummary from "./DebtCardInstallmentSummary";
import DebtCardRecordPaymentForm from "./DebtCardRecordPaymentForm";
import DebtCardRecentPayments from "./DebtCardRecentPayments";
import DebtCardProgressBar from "./DebtCardProgressBar";
import { computeAccumulatedDueNow } from "@/lib/helpers/debts/debtCard";

export default function DebtCardViewDetails(props: {
	debt: DebtCardDebt;
	payments: DebtPayment[];
	budgetPlanId: string;
	paymentMonth: string;
	onRequestEditInstallment: (months: number) => void;
	paymentSource: string;
	onPaymentSourceChange: (next: string) => void;
	paymentCardDebtId: string;
	onPaymentCardDebtIdChange: (next: string) => void;
	creditCardOptions: Array<{ value: string; label: string }>;
	isEditingAmount: boolean;
	onEditingAmountChange: (next: boolean) => void;
	tempDueAmount: string;
	onTempDueAmountChange: (next: string) => void;
	onSaveDueAmount: () => void;
	isPending: boolean;
	effectiveMonthlyPayment: number;
	percentPaid: number;
}) {
	const {
		debt,
		payments,
		budgetPlanId,
		paymentMonth,
		onRequestEditInstallment,
		paymentSource,
		onPaymentSourceChange,
		paymentCardDebtId,
		onPaymentCardDebtIdChange,
		creditCardOptions,
		isEditingAmount,
		onEditingAmountChange,
		tempDueAmount,
		onTempDueAmountChange,
		onSaveDueAmount,
		isPending,
		effectiveMonthlyPayment,
		percentPaid,
	} = props;

	const accumulated = computeAccumulatedDueNow({ debt, payments });
	const isCardDebt = debt.type === "credit_card" || debt.type === "store_card";
	const paidThisMonth = payments
		.filter((p) => p.month === paymentMonth)
		.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
	const monthlyMinimumDue = isCardDebt ? (debt.monthlyMinimum ?? debt.amount) : accumulated.dueNowAmount;
	const remainingDueThisMonth = isCardDebt ? Math.max(0, monthlyMinimumDue - paidThisMonth) : accumulated.dueNowAmount;
	const isPaymentMonthPaid = isCardDebt && monthlyMinimumDue > 0 && paidThisMonth >= monthlyMinimumDue;
	const lockDueAmountEdit = isCardDebt && paidThisMonth > 0;

	return (
		<>
			<DebtCardAmountsGrid
				debt={debt}
				displayDueAmount={remainingDueThisMonth}
				displayDueNote={isCardDebt ? undefined : accumulated.note}
				monthlyMinimumDue={isCardDebt ? monthlyMinimumDue : undefined}
				paidThisMonth={isCardDebt ? paidThisMonth : undefined}
				isPaymentMonthPaid={isCardDebt ? isPaymentMonthPaid : undefined}
				lockDueAmountEdit={lockDueAmountEdit}
				isEditingAmount={isEditingAmount}
				tempDueAmount={tempDueAmount}
				onTempDueAmountChange={onTempDueAmountChange}
				onEditingAmountChange={onEditingAmountChange}
				onSaveDueAmount={onSaveDueAmount}
				isPending={isPending}
			/>

			<DebtCardInstallmentSummary debt={debt} effectiveMonthlyPayment={effectiveMonthlyPayment} />

			<div className="mb-3 sm:mb-4">
				<label className="block text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">
					Installment Plan (spread cost over time)
				</label>
				<div className="flex flex-wrap gap-1.5 sm:gap-2">
					{[0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36].map((months) => (
						<button
							key={months}
							type="button"
							onClick={() => onRequestEditInstallment(months)}
							className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
								(months === 0 && !debt.installmentMonths) || debt.installmentMonths === months
									? "bg-purple-500 text-white"
									: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 border border-white/10"
							}`}
							aria-label={months === 0 ? "No installment plan" : `Set installment plan to ${months} months`}
						>
							{months === 0 ? "None" : `${months} months`}
						</button>
					))}
				</div>
				<div className="mt-1 text-[10px] sm:text-xs text-slate-500">
					Tap an option to edit and save.
				</div>
			</div>

			<DebtCardRecordPaymentForm
				debt={debt}
				budgetPlanId={budgetPlanId}
				paymentMonth={paymentMonth}
				paymentSource={paymentSource}
				onPaymentSourceChange={onPaymentSourceChange}
				paymentCardDebtId={paymentCardDebtId}
				onPaymentCardDebtIdChange={onPaymentCardDebtIdChange}
				creditCardOptions={creditCardOptions}
				defaultPaymentAmount={isCardDebt ? remainingDueThisMonth : accumulated.dueNowAmount}
				isPaymentMonthPaid={isPaymentMonthPaid}
			/>

			<DebtCardRecentPayments payments={payments} budgetPlanId={budgetPlanId} paymentMonth={paymentMonth} debtName={debt.name} />
			<DebtCardProgressBar percentPaid={percentPaid} />
		</>
	);
}
