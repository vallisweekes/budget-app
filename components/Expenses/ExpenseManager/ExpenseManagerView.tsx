"use client";

import type { ExpenseManagerProps } from "@/types/expenses-manager";
import type { UseExpenseManagerResult } from "@/components/Expenses/ExpenseManager/useExpenseManager";
import DeleteExpenseModal from "@/components/Expenses/ExpenseManager/DeleteExpenseModal";
import EditExpenseModal from "@/components/Expenses/ExpenseManager/EditExpenseModal";
import ExpenseManagerToolbar from "@/components/Expenses/ExpenseManager/ExpenseManagerToolbar";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import AddExpenseForm from "@/components/Expenses/ExpenseManager/AddExpenseForm";
import ExpenseCardsSkeleton from "@/components/Expenses/ExpenseManager/ExpenseCardsSkeleton";
import CategorySection from "@/components/Expenses/ExpenseManager/CategorySection";
import UncategorizedSection from "@/components/Expenses/ExpenseManager/UncategorizedSection";
import EmptyExpensesState from "@/components/Expenses/ExpenseManager/EmptyExpensesState";
import { Skeleton } from "@/components/Shared";

type Props = ExpenseManagerProps & UseExpenseManagerResult;

export default function ExpenseManagerView({
	budgetPlanId,
	budgetHorizonYears,
	horizonYearsByPlan,
	month,
	year,
	expenses,
	categories,
	allPlans,
	allCategoriesByPlan,
	payDate,
	incomeHref,
	isPending,
	isPeriodLoading,
	showAddForm,
	setShowAddForm,
	searchQuery,
	setSearchQuery,
	statusFilter,
	setStatusFilter,
	minAmountFilter,
	setMinAmountFilter,
	collapsedCategories,
	toggleCategory,
	filteredExpenses,
	uncategorized,
	expensesByCategory,
	categoryLookup,
	paymentByExpenseId,
	setPaymentByExpenseId,
	expensePendingDelete,
	deleteError,
	handleRemoveClick,
	confirmRemove,
	closeDelete,
	expensePendingEdit,
	handleEditClick,
	handleEditSubmit,
	closeEdit,
	inlineAddCategoryId,
	inlineAddError,
	openInlineAdd,
	closeInlineAdd,
	handleInlineAddSubmit,
	handleTogglePaid,
	handleApplyPayment,
	onAddedExpense,
	onAddError,
}: Props) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<DeleteExpenseModal
				open={expensePendingDelete != null}
				expenseName={expensePendingDelete?.name}
				errorMessage={deleteError}
				isBusy={isPending}
				onClose={closeDelete}
				onConfirm={(scope) => confirmRemove(scope)}
			/>

			<EditExpenseModal
				open={expensePendingEdit != null}
				budgetPlanId={budgetPlanId}
				month={month}
				year={year}
				payDate={payDate}
				categories={categories}
				expense={expensePendingEdit}
				isBusy={isPending}
				onClose={closeEdit}
				onSubmit={(data) => handleEditSubmit(data)}
			/>

			<ExpenseManagerToolbar
				subtitle={`${formatMonthKeyLabel(month)} ${year}`}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				minAmountFilter={minAmountFilter}
				onMinAmountFilterChange={setMinAmountFilter}
				showAddForm={showAddForm}
				onToggleAddForm={() => setShowAddForm((prev) => !prev)}
				isDisabled={isPeriodLoading}
			/>

			<div className="text-xs text-slate-400">
				{isPeriodLoading ? (
					<span className="inline-flex items-center gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-20" />
					</span>
				) : (
					<>
						Showing <span className="text-slate-200 font-medium">{filteredExpenses.length}</span> of{" "}
						<span className="text-slate-200 font-medium">{expenses.length}</span> expenses
					</>
				)}
			</div>

			{showAddForm && !isPeriodLoading && (
				<AddExpenseForm
					budgetPlanId={budgetPlanId}
					month={month}
					year={year}
					categories={categories}
					allPlans={allPlans}
					allCategoriesByPlan={allCategoriesByPlan}
					horizonYearsByPlan={horizonYearsByPlan}
					budgetHorizonYears={budgetHorizonYears}
					payDate={payDate}
					onAdded={onAddedExpense}
					onError={onAddError}
				/>
			)}

			{isPeriodLoading ? (
				<ExpenseCardsSkeleton />
			) : (
				<div className="grid grid-cols-1 gap-3">
					{Object.entries(expensesByCategory).map(([catId, catExpenses]) => {
						const category = categoryLookup[catId];
						if (!category) return null;

						return (
							<CategorySection
								key={catId}
								category={category}
								expenses={catExpenses}
								month={month}
								year={year}
								payDate={payDate}
								isBusy={isPending}
								isCollapsed={collapsedCategories[catId] ?? true}
								onToggleCollapsed={() => toggleCategory(catId)}
								inlineAddOpen={inlineAddCategoryId === catId}
								inlineAddError={inlineAddError}
								onInlineAddOpen={() => openInlineAdd(catId)}
								onInlineAddCancel={closeInlineAdd}
								onInlineAddSubmit={(data) => handleInlineAddSubmit(data)}
								paymentByExpenseId={paymentByExpenseId}
								onPaymentValueChange={(expenseId, value) =>
									setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: value }))
								}
								onTogglePaid={(expenseId) => handleTogglePaid(expenseId)}
								onEdit={(expense) => handleEditClick(expense)}
								onDelete={(expense) => handleRemoveClick(expense)}
								onApplyPayment={(expenseId) => handleApplyPayment(expenseId)}
								budgetPlanId={budgetPlanId}
							/>
						);
					})}
				</div>
			)}

			<UncategorizedSection
				expenses={uncategorized}
				month={month}
				year={year}
				payDate={payDate}
				isBusy={isPending}
				isCollapsed={collapsedCategories.uncategorized ?? true}
				onToggleCollapsed={() => toggleCategory("uncategorized")}
				paymentByExpenseId={paymentByExpenseId}
				onPaymentValueChange={(expenseId, value) => setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
				onTogglePaid={(expenseId) => handleTogglePaid(expenseId)}
				onEdit={(expense) => handleEditClick(expense)}
				onDelete={(expense) => handleRemoveClick(expense)}
				onApplyPayment={(expenseId) => handleApplyPayment(expenseId)}
			/>

			{filteredExpenses.length === 0 && !showAddForm && (
				<EmptyExpensesState
					incomeHref={incomeHref}
					hasSearch={Boolean(searchQuery.trim())}
					onAddClick={() => setShowAddForm(true)}
				/>
			)}
		</div>
	);
}
