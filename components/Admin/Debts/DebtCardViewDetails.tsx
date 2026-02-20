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

			<DebtCardRecentPayments payments={payments} />
			<DebtCardProgressBar percentPaid={percentPaid} />
		</>
	);
}
