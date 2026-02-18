"use client";

import type { ExpenseManagerProps } from "@/types/expenses-manager";
import type { UseExpenseManagerResult } from "@/components/Expenses/ExpenseManager/useExpenseManager";
import DeleteExpenseModal from "@/components/Expenses/ExpenseManager/DeleteExpenseModal";
import EditExpenseModal from "@/components/Expenses/ExpenseManager/EditExpenseModal";
import ExpenseManagerToolbar from "@/components/Expenses/ExpenseManager/ExpenseManagerToolbar";
import { formatMonthKeyLabel, formatMonthKeyShortLabel } from "@/lib/helpers/monthKey";
import AddExpenseForm from "@/components/Expenses/ExpenseManager/AddExpenseForm";
import ExpenseCardsSkeleton from "@/components/Expenses/ExpenseManager/ExpenseCardsSkeleton";
import CategorySection from "@/components/Expenses/ExpenseManager/CategorySection";
import UncategorizedSection from "@/components/Expenses/ExpenseManager/UncategorizedSection";
import EmptyExpensesState from "@/components/Expenses/ExpenseManager/EmptyExpensesState";
import { Skeleton } from "@/components/Shared";
import { X } from "lucide-react";

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
	hasAnyIncome,
	emptyExpensesJumpTarget,
	onJumpToEmptyExpensesTarget,
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
	paymentSourceByExpenseId,
	setPaymentSourceByExpenseId,
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
	const selectedPlanKind = allPlans?.find((p) => p.id === budgetPlanId)?.kind ?? "personal";

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

			{showAddForm && !isPeriodLoading ? (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => {
							if (!isPending) setShowAddForm(false);
						}}
						aria-label="Close add expense"
					/>
					<div className="relative mx-auto mt-10 w-[calc(100%-2rem)] max-w-2xl">
						<div className="relative">
							<button
								type="button"
								onClick={() => {
								if (!isPending) setShowAddForm(false);
							}}
								disabled={isPending}
								className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/10 disabled:opacity-60"
								title="Close"
							>
								<X size={18} />
							</button>

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
								isBusy={isPending}
								onAdded={onAddedExpense}
								onError={onAddError}
							/>
						</div>
					</div>
				</div>
			) : null}

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
								paymentSourceByExpenseId={paymentSourceByExpenseId}
								onPaymentSourceChange={(expenseId, value) =>
									setPaymentSourceByExpenseId((prev) => ({ ...prev, [expenseId]: value }))
								}
								planKind={selectedPlanKind}
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
				paymentSourceByExpenseId={paymentSourceByExpenseId}
				onPaymentSourceChange={(expenseId, value) => setPaymentSourceByExpenseId((prev) => ({ ...prev, [expenseId]: value }))}
				planKind={selectedPlanKind}
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
					jumpTarget={emptyExpensesJumpTarget}
					onJumpToTarget={onJumpToEmptyExpensesTarget}
					hasAnyIncome={hasAnyIncome}
					monthLabel={formatMonthKeyShortLabel(month)}
				/>
			)}
		</div>
	);
}
