"use client";

import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "./debtCardTypes";
import DebtCardAmountsGrid from "./DebtCardAmountsGrid";
import DebtCardInstallmentSummary from "./DebtCardInstallmentSummary";
import DebtCardRecordPaymentForm from "./DebtCardRecordPaymentForm";
import DebtCardRecentPayments from "./DebtCardRecentPayments";
import DebtCardProgressBar from "./DebtCardProgressBar";

export default function DebtCardViewDetails(props: {
	debt: DebtCardDebt;
	payments: DebtPayment[];
	budgetPlanId: string;
	paymentMonth: string;
	paymentSource: string;
	onPaymentSourceChange: (next: string) => void;
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
		isEditingAmount,
		onEditingAmountChange,
		tempDueAmount,
		onTempDueAmountChange,
		onSaveDueAmount,
		isPending,
		effectiveMonthlyPayment,
		percentPaid,
	} = props;

	return (
		<>
			<DebtCardAmountsGrid
				debt={debt}
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
			/>

			<DebtCardRecentPayments payments={payments} />
			<DebtCardProgressBar percentPaid={percentPaid} />
		</>
	);
}
