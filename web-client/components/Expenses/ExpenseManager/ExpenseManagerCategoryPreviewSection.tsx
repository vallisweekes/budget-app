"use client";

import type { ExpenseItem, MonthKey } from "@/types";
import type { CreditCardOption, DebtOption, ExpenseCategoryOption } from "@/types/expenses-manager";

import CategorySection from "@/components/Expenses/ExpenseManager/CategorySection";

export default function ExpenseManagerCategoryPreviewSection({
	catId,
	category,
	expenses,
	month,
	year,
	payDate,
	isBusy,
	inlineAddOpen,
	inlineAddError,
	onInlineAddOpen,
	onInlineAddCancel,
	onInlineAddSubmit,
	paymentByExpenseId,
	setPaymentByExpenseId,
	paymentSourceByExpenseId,
	setPaymentSourceByExpenseId,
	creditCards,
	cardDebtIdByExpenseId,
	setCardDebtIdByExpenseId,
	debts,
	debtIdByExpenseId,
	setDebtIdByExpenseId,
	planKind,
	onTogglePaid,
	onEdit,
	onDelete,
	onApplyPayment,
	onView,
	budgetPlanId,
}: {
	catId: string;
	category: ExpenseCategoryOption;
	expenses: ExpenseItem[];
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	inlineAddOpen: boolean;
	inlineAddError?: string | null;
	onInlineAddOpen: () => void;
	onInlineAddCancel: () => void;
	onInlineAddSubmit: (data: FormData) => void;
	paymentByExpenseId: Record<string, string>;
	setPaymentByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	paymentSourceByExpenseId: Record<string, string>;
	setPaymentSourceByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdByExpenseId: Record<string, string>;
	setCardDebtIdByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	debts?: DebtOption[];
	debtIdByExpenseId: Record<string, string>;
	setDebtIdByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	planKind: string;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
	onView: () => void;
	budgetPlanId: string;
}) {
	return (
		<CategorySection
			key={catId}
			variant="preview"
			onView={onView}
			category={category}
			expenses={expenses}
			month={month}
			year={year}
			payDate={payDate}
			isBusy={isBusy}
			isCollapsed={false}
			onToggleCollapsed={() => {}}
			inlineAddOpen={inlineAddOpen}
			inlineAddError={inlineAddError}
			onInlineAddOpen={onInlineAddOpen}
			onInlineAddCancel={onInlineAddCancel}
			onInlineAddSubmit={onInlineAddSubmit}
			paymentByExpenseId={paymentByExpenseId}
			onPaymentValueChange={(expenseId, value) => setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
			paymentSourceByExpenseId={paymentSourceByExpenseId}
			onPaymentSourceChange={(expenseId, value) =>
				setPaymentSourceByExpenseId((prev) => ({ ...prev, [expenseId]: value }))
			}
			creditCards={creditCards ?? []}
			cardDebtIdByExpenseId={cardDebtIdByExpenseId}
			onCardDebtIdChange={(expenseId, value) => setCardDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
			debts={debts ?? []}
			debtIdByExpenseId={debtIdByExpenseId}
			onDebtIdChange={(expenseId, value) => setDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
			planKind={planKind}
			onTogglePaid={onTogglePaid}
			onEdit={onEdit}
			onDelete={onDelete}
			onApplyPayment={onApplyPayment}
			budgetPlanId={budgetPlanId}
		/>
	);
}
