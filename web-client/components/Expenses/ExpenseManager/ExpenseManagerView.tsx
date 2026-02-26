"use client";

import type { ExpenseManagerProps } from "@/types/expenses-manager";
import type { UseExpenseManagerResult } from "@/components/Expenses/ExpenseManager/useExpenseManager";
import DeleteExpenseModal from "@/components/Expenses/ExpenseManager/DeleteExpenseModal";
import EditExpenseModal from "@/components/Expenses/ExpenseManager/EditExpenseModal";
import ExpenseManagerToolbar from "@/components/Expenses/ExpenseManager/ExpenseManagerToolbar";
import { formatMonthKeyLabel, formatMonthKeyShortLabel } from "@/lib/helpers/monthKey";
import ExpenseCardsSkeleton from "@/components/Expenses/ExpenseManager/ExpenseCardsSkeleton";
import EmptyExpensesState from "@/components/Expenses/ExpenseManager/EmptyExpensesState";
import ExpenseManagerAddExpenseModal from "@/components/Expenses/ExpenseManager/ExpenseManagerAddExpenseModal";
import ExpenseManagerCategoryPreviewSection from "@/components/Expenses/ExpenseManager/ExpenseManagerCategoryPreviewSection";
import ExpenseManagerUncategorizedPreviewSection from "@/components/Expenses/ExpenseManager/ExpenseManagerUncategorizedPreviewSection";
import { Skeleton } from "@/components/Shared";
import { usePathname, useRouter } from "next/navigation";
import { buildScopedPageHrefForPlan } from "@/lib/helpers/scopedPageHref";

type Props = ExpenseManagerProps & UseExpenseManagerResult;

export default function ExpenseManagerView(props: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const selectedPlanKind = props.allPlans?.find((p) => p.id === props.budgetPlanId)?.kind ?? "personal";

	const navigateToCategory = (categoryId: string) => {
		const base = buildScopedPageHrefForPlan(pathname, props.budgetPlanId, "expense-category");
		router.push(
			`${base}/${encodeURIComponent(categoryId)}?year=${encodeURIComponent(String(props.year))}&month=${encodeURIComponent(props.month)}`
		);
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			<DeleteExpenseModal
				open={props.expensePendingDelete != null}
				expenseName={props.expensePendingDelete?.name}
				errorMessage={props.deleteError}
				isBusy={props.isPending}
				onClose={props.closeDelete}
				onConfirm={(scope) => props.confirmRemove(scope)}
			/>

			<EditExpenseModal
				open={props.expensePendingEdit != null}
				budgetPlanId={props.budgetPlanId}
				month={props.month}
				year={props.year}
				payDate={props.payDate}
				categories={props.categories}
				expense={props.expensePendingEdit}
				isBusy={props.isPending}
				onClose={props.closeEdit}
				onSubmit={(data) => props.handleEditSubmit(data)}
			/>

			<ExpenseManagerToolbar
				subtitle={`${formatMonthKeyLabel(props.month)} ${props.year}`}
				searchQuery={props.searchQuery}
				onSearchQueryChange={props.setSearchQuery}
				statusFilter={props.statusFilter}
				onStatusFilterChange={props.setStatusFilter}
				minAmountFilter={props.minAmountFilter}
				onMinAmountFilterChange={props.setMinAmountFilter}
				showAddForm={props.showAddForm}
				onToggleAddForm={() => props.setShowAddForm((prev) => !prev)}
				isDisabled={props.isPeriodLoading}
			/>

			<ExpenseManagerAddExpenseModal
				open={props.showAddForm && !props.isPeriodLoading}
				onRequestClose={() => props.setShowAddForm(false)}
				formProps={{
					budgetPlanId: props.budgetPlanId,
					month: props.month,
					year: props.year,
					categories: props.categories,
					creditCards: props.creditCards,
					creditCardsByPlan: props.creditCardsByPlan,
					debts: props.debts,
					debtsByPlan: props.debtsByPlan,
					allPlans: props.allPlans,
					allCategoriesByPlan: props.allCategoriesByPlan,
					horizonYearsByPlan: props.horizonYearsByPlan,
					budgetHorizonYears: props.budgetHorizonYears,
					payDate: props.payDate,
					isBusy: props.isPending,
					onAdded: props.onAddedExpense,
					onError: props.onAddError,
				}}
			/>

			<div className="text-xs text-slate-400">
				{props.isPeriodLoading ? (
					<span className="inline-flex items-center gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-20" />
					</span>
				) : (
					<>
						Showing <span className="text-slate-200 font-medium">{props.filteredExpenses.length}</span> of{" "}
						<span className="text-slate-200 font-medium">{props.expenses.length}</span> expenses
					</>
				)}
			</div>

			{props.isPeriodLoading ? (
				<ExpenseCardsSkeleton />
			) : (
				<div className="grid grid-cols-1 gap-3">
					{Object.entries(props.expensesByCategory).map(([catId, catExpenses]) => {
						const category = props.categoryLookup[catId];
						if (!category) return null;

						return (
							<ExpenseManagerCategoryPreviewSection
								key={catId}
								catId={catId}
								category={category}
								expenses={catExpenses}
								month={props.month}
								year={props.year}
								payDate={props.payDate}
								isBusy={props.isPending}
								inlineAddOpen={props.inlineAddCategoryId === catId}
								inlineAddError={props.inlineAddError}
								onInlineAddOpen={() => props.openInlineAdd(catId)}
								onInlineAddCancel={props.closeInlineAdd}
								onInlineAddSubmit={props.handleInlineAddSubmit}
								paymentByExpenseId={props.paymentByExpenseId}
								setPaymentByExpenseId={props.setPaymentByExpenseId}
								paymentSourceByExpenseId={props.paymentSourceByExpenseId}
								setPaymentSourceByExpenseId={props.setPaymentSourceByExpenseId}
								creditCards={props.creditCards ?? []}
								cardDebtIdByExpenseId={props.cardDebtIdByExpenseId}
								setCardDebtIdByExpenseId={props.setCardDebtIdByExpenseId}
								debts={props.debts ?? []}
								debtIdByExpenseId={props.debtIdByExpenseId}
								setDebtIdByExpenseId={props.setDebtIdByExpenseId}
								planKind={selectedPlanKind}
								onTogglePaid={props.handleTogglePaid}
								onEdit={props.handleEditClick}
								onDelete={props.handleRemoveClick}
								onApplyPayment={props.handleApplyPayment}
								onView={() => navigateToCategory(catId)}
								budgetPlanId={props.budgetPlanId}
							/>
						);
					})}
				</div>
			)}

			<ExpenseManagerUncategorizedPreviewSection
				expenses={props.uncategorized}
				month={props.month}
				year={props.year}
				payDate={props.payDate}
				isBusy={props.isPending}
				paymentByExpenseId={props.paymentByExpenseId}
				setPaymentByExpenseId={props.setPaymentByExpenseId}
				paymentSourceByExpenseId={props.paymentSourceByExpenseId}
				setPaymentSourceByExpenseId={props.setPaymentSourceByExpenseId}
				creditCards={props.creditCards ?? []}
				cardDebtIdByExpenseId={props.cardDebtIdByExpenseId}
				setCardDebtIdByExpenseId={props.setCardDebtIdByExpenseId}
				debts={props.debts ?? []}
				debtIdByExpenseId={props.debtIdByExpenseId}
				setDebtIdByExpenseId={props.setDebtIdByExpenseId}
				planKind={selectedPlanKind}
				onTogglePaid={props.handleTogglePaid}
				onEdit={props.handleEditClick}
				onDelete={props.handleRemoveClick}
				onApplyPayment={props.handleApplyPayment}
				onView={() => navigateToCategory("uncategorized")}
			/>

			{props.filteredExpenses.length === 0 && !props.showAddForm && (
				<EmptyExpensesState
					incomeHref={props.incomeHref}
					hasSearch={Boolean(props.searchQuery.trim())}
					onAddClick={() => props.setShowAddForm(true)}
					jumpTarget={props.emptyExpensesJumpTarget}
					onJumpToTarget={props.onJumpToEmptyExpensesTarget}
					hasAnyIncome={props.hasAnyIncome}
					monthLabel={formatMonthKeyShortLabel(props.month)}
				/>
			)}
		</div>
	);
}
