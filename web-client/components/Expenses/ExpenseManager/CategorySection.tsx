"use client";

import type { MonthKey, ExpenseItem } from "@/types";
import { getSimpleColorClasses } from "@/lib/helpers/colors";
import type {
	CreditCardOption,
	DebtOption,
	ExpenseCategoryOption,
} from "@/types/expenses-manager";
import ExpenseRow from "@/components/Expenses/ExpenseManager/ExpenseRow";
import CategorySectionHeader from "@/components/Expenses/ExpenseManager/CategorySectionHeader";
import CategorySectionPreviewList from "@/components/Expenses/ExpenseManager/CategorySectionPreviewList";
import CategoryInlineAdd from "@/components/Expenses/ExpenseManager/CategoryInlineAdd";

type Props = {
	category: ExpenseCategoryOption;
	expenses: ExpenseItem[];
	variant?: "full" | "preview";
	onView?: () => void;
	planKind: string;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	isCollapsed: boolean;
	onToggleCollapsed: () => void;
	hideInlineAdd?: boolean;
	inlineAddOpen: boolean;
	inlineAddError?: string | null;
	onInlineAddOpen: () => void;
	onInlineAddCancel: () => void;
	onInlineAddSubmit: (data: FormData) => void;
	paymentByExpenseId: Record<string, string>;
	onPaymentValueChange: (expenseId: string, value: string) => void;
	paymentSourceByExpenseId: Record<string, string>;
	onPaymentSourceChange: (expenseId: string, value: string) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdByExpenseId: Record<string, string>;
	onCardDebtIdChange: (expenseId: string, value: string) => void;
	debts?: DebtOption[];
	debtIdByExpenseId: Record<string, string>;
	onDebtIdChange: (expenseId: string, value: string) => void;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
	budgetPlanId: string;
};

export default function CategorySection({
	category,
	expenses,
	variant = "full",
	onView,
	planKind,
	month,
	year,
	payDate,
	isBusy,
	isCollapsed,
	onToggleCollapsed,
	hideInlineAdd,
	inlineAddOpen,
	inlineAddError,
	onInlineAddOpen,
	onInlineAddCancel,
	onInlineAddSubmit,
	paymentByExpenseId,
	onPaymentValueChange,
	paymentSourceByExpenseId,
	onPaymentSourceChange,
	creditCards,
	cardDebtIdByExpenseId,
	onCardDebtIdChange,
	debts,
	debtIdByExpenseId,
	onDebtIdChange,
	onTogglePaid,
	onEdit,
	onDelete,
	onApplyPayment,
	budgetPlanId,
}: Props) {
	const colors = getSimpleColorClasses(category.color, "blue");
	const gradient = colors.bg;
	const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
	const paidCount = expenses.filter((e) => e.paid).length;
	const previewLimit = 3;
	const previewExpenses = expenses.slice(0, previewLimit);

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
			<CategorySectionHeader
				variant={variant}
				category={category}
				gradient={gradient}
				expensesCount={expenses.length}
				paidCount={paidCount}
				totalAmount={totalAmount}
				onView={onView}
				isCollapsed={isCollapsed}
				onToggleCollapsed={onToggleCollapsed}
			/>

			{variant === "preview" ? (
				<CategorySectionPreviewList
					previewExpenses={previewExpenses}
					expensesCount={expenses.length}
					previewLimit={previewLimit}
					month={month}
					year={year}
					payDate={payDate}
					onView={onView}
				/>
			) : !isCollapsed ? (
				<div className="divide-y divide-white/10">
					{hideInlineAdd ? null : (
						<CategoryInlineAdd
							open={inlineAddOpen}
							error={inlineAddError}
							isBusy={isBusy}
							onOpen={onInlineAddOpen}
							onCancel={onInlineAddCancel}
							onSubmit={onInlineAddSubmit}
							budgetPlanId={budgetPlanId}
							month={month}
							year={year}
							categoryId={category.id}
							categoryName={category.name}
						/>
					)}

					{expenses.map((expense) => (
						<div key={expense.id} className="p-2 sm:p-4 hover:bg-slate-900/40 transition-all group">
							<ExpenseRow
								expense={expense}
								planKind={planKind}
								month={month}
								year={year}
								payDate={payDate}
								isBusy={isBusy}
								paymentValue={paymentByExpenseId[expense.id] ?? ""}
								onPaymentValueChange={(value) => onPaymentValueChange(expense.id, value)}
								paymentSourceValue={paymentSourceByExpenseId[expense.id] ?? "income"}
								onPaymentSourceChange={(value) => onPaymentSourceChange(expense.id, value)}
								creditCards={creditCards}
								cardDebtIdValue={cardDebtIdByExpenseId[expense.id] ?? ""}
								onCardDebtIdChange={(value) => onCardDebtIdChange(expense.id, value)}
								debts={debts}
								debtIdValue={debtIdByExpenseId[expense.id] ?? ""}
								onDebtIdChange={(value) => onDebtIdChange(expense.id, value)}
								onTogglePaid={() => onTogglePaid(expense.id)}
								onEdit={() => onEdit(expense)}
								onDelete={() => onDelete(expense)}
								onApplyPayment={() => onApplyPayment(expense.id)}
								showDueBadge
								showAllocationBadge
							/>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
