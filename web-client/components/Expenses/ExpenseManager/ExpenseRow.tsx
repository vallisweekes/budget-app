"use client";

import type { ExpenseItem, MonthKey } from "@/types";
import type { CreditCardOption, DebtOption } from "@/types/expenses-manager";
import ExpenseRowHeader from "@/components/Expenses/ExpenseManager/ExpenseRowHeader";
import ExpenseRowPaymentSummary from "@/components/Expenses/ExpenseManager/ExpenseRowPaymentSummary";
import ExpenseRowPaymentControls from "@/components/Expenses/ExpenseManager/ExpenseRowPaymentControls";

type Props = {
	expense: ExpenseItem;
	planKind: string;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	paymentValue: string;
	onPaymentValueChange: (value: string) => void;
	paymentSourceValue: string;
	onPaymentSourceChange: (value: string) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdValue?: string;
	onCardDebtIdChange?: (value: string) => void;
	debts?: DebtOption[];
	debtIdValue?: string;
	onDebtIdChange?: (value: string) => void;
	onTogglePaid: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onApplyPayment: () => void;
	showDueBadge?: boolean;
	showAllocationBadge?: boolean;
	showPartialPaidBadge?: boolean;
};


export default function ExpenseRow(props: Props) {
	const {
		expense,
		month,
		year,
		payDate,
		isBusy,
		paymentValue,
		onPaymentValueChange,
		paymentSourceValue,
		onPaymentSourceChange,
		creditCards,
		cardDebtIdValue,
		onCardDebtIdChange,
		debts,
		debtIdValue,
		onDebtIdChange,
		onTogglePaid,
		onEdit,
		onDelete,
		onApplyPayment,
		showDueBadge = false,
		showAllocationBadge = false,
		showPartialPaidBadge = false,
	} = props;

	const isPaid = !!expense.paid;
	const paidAmount = isPaid ? expense.amount : (expense.paidAmount ?? 0);
	const remaining = Math.max(0, expense.amount - paidAmount);
	const cards = creditCards ?? [];
	const debtOptions = debts ?? [];
	const isCreditCard = paymentSourceValue === "credit_card";
	const cardRequired = isCreditCard && cards.length > 1;
	const hasSelectedCard = Boolean((cardDebtIdValue ?? "").trim());
	const disableMarkPaid =
		!isPaid &&
		isCreditCard &&
		(cards.length === 0 || (cardRequired && !hasSelectedCard));

	return (
		<div className="space-y-2 sm:space-y-3">
			<ExpenseRowHeader
				expense={expense}
				month={month}
				year={year}
				payDate={payDate}
				isBusy={isBusy}
				isPaid={isPaid}
				disableMarkPaid={disableMarkPaid}
				onTogglePaid={onTogglePaid}
				onEdit={onEdit}
				onDelete={onDelete}
				showDueBadge={showDueBadge}
				showAllocationBadge={showAllocationBadge}
				showPartialPaidBadge={showPartialPaidBadge}
			/>

			<div className="flex flex-col gap-1.5 sm:gap-2">
				<ExpenseRowPaymentSummary paidAmount={paidAmount} remaining={remaining} totalAmount={expense.amount} />

				{remaining > 0 ? (
					<ExpenseRowPaymentControls
						paymentValue={paymentValue}
						onPaymentValueChange={onPaymentValueChange}
						paymentSourceValue={paymentSourceValue}
						onPaymentSourceChange={onPaymentSourceChange}
						debtOptions={debtOptions}
						debtIdValue={debtIdValue}
						onDebtIdChange={onDebtIdChange}
						cards={cards}
						cardDebtIdValue={cardDebtIdValue}
						onCardDebtIdChange={onCardDebtIdChange}
						onApplyPayment={onApplyPayment}
						isBusy={isBusy}
					/>
				) : null}
			</div>
		</div>
	);
}
