"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MonthKey, ExpenseItem } from "@/types";
import type { CategoryConfig } from "@/lib/categories/store";
import type { CreditCardOption, DebtOption } from "@/types/expenses-manager";
import { HeroCanvasLayoutClient } from "@/components/Shared";
import { buildScopedPageHrefForPlan } from "@/lib/helpers/scopedPageHref";
import DeleteExpenseModal from "@/components/Expenses/ExpenseManager/DeleteExpenseModal";
import EditExpenseModal from "@/components/Expenses/ExpenseManager/EditExpenseModal";
import CategorySection from "@/components/Expenses/ExpenseManager/CategorySection";
import UncategorizedSection from "@/components/Expenses/ExpenseManager/UncategorizedSection";
import { useExpenseManager } from "@/components/Expenses/ExpenseManager/useExpenseManager";
import {
	addExpenseAction,
	applyExpensePaymentAction,
	removeExpenseAction,
	togglePaidAction,
	updateExpenseAction,
} from "@/app/admin/expenses/actions";

export type ExpenseCategoryPageClientProps = {
	budgetPlanId: string;
	planKind: string;
	payDate: number;
	year: number;
	month: MonthKey;
	categoryId: string;
	category: CategoryConfig | null;
	expenses: ExpenseItem[];
	categories: CategoryConfig[];
	creditCards: CreditCardOption[];
	debts: DebtOption[];
};

export default function ExpenseCategoryPageClient(props: ExpenseCategoryPageClientProps) {
	const router = useRouter();
	const pathname = usePathname();

	const logic = useExpenseManager({
		budgetPlanId: props.budgetPlanId,
		initialOpenCategoryId: props.categoryId,
		month: props.month,
		year: props.year,
		expenses: props.expenses,
		categories: props.categories,
		loading: false,
		actions: {
			addExpenseAction,
			applyExpensePaymentAction,
			removeExpenseAction,
			togglePaidAction,
			updateExpenseAction,
		},
	});

	const backHref = useMemo(() => {
		const base = buildScopedPageHrefForPlan(pathname, props.budgetPlanId, "expenses");
		return `${base}?year=${encodeURIComponent(String(props.year))}&month=${encodeURIComponent(props.month)}`;
	}, [pathname, props.budgetPlanId, props.month, props.year]);

	return (
		<HeroCanvasLayoutClient
			hero={
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<h1 className="text-2xl sm:text-3xl font-bold text-white">
							{props.categoryId === "uncategorized" ? "Miscellaneous" : (props.category?.name ?? "Category")}
						</h1>
					</div>
					<button
						type="button"
						onClick={() => router.push(backHref)}
						className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white transition"
						aria-label="Back to expenses"
					>
						<ArrowLeft size={16} />
						Back to expenses
					</button>
				</div>
			}
		>
			<DeleteExpenseModal
				open={logic.expensePendingDelete != null}
				expenseName={logic.expensePendingDelete?.name}
				errorMessage={logic.deleteError}
				isBusy={logic.isPending}
				onClose={logic.closeDelete}
				onConfirm={(scope) => logic.confirmRemove(scope)}
			/>

			<EditExpenseModal
				open={logic.expensePendingEdit != null}
				budgetPlanId={props.budgetPlanId}
				month={props.month}
				year={props.year}
				payDate={props.payDate}
				categories={props.categories}
				expense={logic.expensePendingEdit}
				isBusy={logic.isPending}
				onClose={logic.closeEdit}
				onSubmit={(data) => logic.handleEditSubmit(data)}
			/>

			<div className="space-y-4">
				{logic.filteredExpenses.length === 0 ? (
					<div className="rounded-3xl border border-white/10 bg-slate-900/30 px-6 py-10 text-center">
						<div className="text-base font-semibold text-white">No expenses in this category</div>
						<div className="mt-4">
							<button
								type="button"
								onClick={() => router.push(backHref)}
								className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white transition"
							>
								<ArrowLeft size={16} />
								Back to expenses
							</button>
						</div>
					</div>
				) : props.categoryId === "uncategorized" ? (
					<UncategorizedSection
						expenses={logic.filteredExpenses}
						month={props.month}
						year={props.year}
						payDate={props.payDate}
						isBusy={logic.isPending}
						isCollapsed={false}
						onToggleCollapsed={() => {}}
						paymentByExpenseId={logic.paymentByExpenseId}
						onPaymentValueChange={(expenseId, value) => logic.setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						paymentSourceByExpenseId={logic.paymentSourceByExpenseId}
						onPaymentSourceChange={(expenseId, value) => logic.setPaymentSourceByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						creditCards={props.creditCards}
						cardDebtIdByExpenseId={logic.cardDebtIdByExpenseId}
						onCardDebtIdChange={(expenseId, value) => logic.setCardDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						debts={props.debts}
						debtIdByExpenseId={logic.debtIdByExpenseId}
						onDebtIdChange={(expenseId, value) => logic.setDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						planKind={props.planKind}
						onTogglePaid={(expenseId) => logic.handleTogglePaid(expenseId)}
						onEdit={(expense) => logic.handleEditClick(expense)}
						onDelete={(expense) => logic.handleRemoveClick(expense)}
						onApplyPayment={(expenseId) => logic.handleApplyPayment(expenseId)}
					/>
				) : (
					<CategorySection
						category={{
							id: props.category?.id ?? props.categoryId,
							name: props.category?.name ?? "Category",
							icon: props.category?.icon,
							color: props.category?.color,
						}}
						expenses={logic.filteredExpenses}
						month={props.month}
						year={props.year}
						payDate={props.payDate}
						isBusy={logic.isPending}
						isCollapsed={false}
						onToggleCollapsed={() => {}}
						hideInlineAdd
						inlineAddOpen={false}
						inlineAddError={null}
						onInlineAddOpen={() => {}}
						onInlineAddCancel={() => {}}
						onInlineAddSubmit={() => {}}
						paymentByExpenseId={logic.paymentByExpenseId}
						onPaymentValueChange={(expenseId, value) => logic.setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						paymentSourceByExpenseId={logic.paymentSourceByExpenseId}
						onPaymentSourceChange={(expenseId, value) => logic.setPaymentSourceByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						creditCards={props.creditCards}
						cardDebtIdByExpenseId={logic.cardDebtIdByExpenseId}
						onCardDebtIdChange={(expenseId, value) => logic.setCardDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						debts={props.debts}
						debtIdByExpenseId={logic.debtIdByExpenseId}
						onDebtIdChange={(expenseId, value) => logic.setDebtIdByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
						planKind={props.planKind}
						onTogglePaid={(expenseId) => logic.handleTogglePaid(expenseId)}
						onEdit={(expense) => logic.handleEditClick(expense)}
						onDelete={(expense) => logic.handleRemoveClick(expense)}
						onApplyPayment={(expenseId) => logic.handleApplyPayment(expenseId)}
						budgetPlanId={props.budgetPlanId}
					/>
				)}
			</div>
		</HeroCanvasLayoutClient>
	);
}
