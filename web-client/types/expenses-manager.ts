import type { ExpenseItem, MonthKey } from "@/types";

export type ExpenseStatusFilter = "all" | "paid" | "unpaid";

export type ExpenseCategoryOption = {
	id: string;
	name: string;
	icon?: string;
	color?: string;
};

export type ExpenseBudgetPlanOption = {
	id: string;
	name: string;
	kind: string;
};

export type CreditCardOption = {
	id: string;
	name: string;
};

export type DebtOption = {
	id: string;
	name: string;
	type?: string;
};

export type EmptyExpensesJumpTarget = {
	year: number;
	month: MonthKey;
	tabKey?: string;
	label: string;
};

export type ExpenseManagerProps = {
	budgetPlanId: string;
	budgetHorizonYears?: number;
	horizonYearsByPlan?: Record<string, number>;
	initialOpenCategoryId?: string | null;
	month: MonthKey;
	year: number;
	expenses: ExpenseItem[];
	categories: ExpenseCategoryOption[];
	creditCards?: CreditCardOption[];
	creditCardsByPlan?: Record<string, CreditCardOption[]>;
	debts?: DebtOption[];
	debtsByPlan?: Record<string, DebtOption[]>;
	loading?: boolean;
	allPlans?: ExpenseBudgetPlanOption[];
	allCategoriesByPlan?: Record<string, ExpenseCategoryOption[]>;
	payDate: number;
	hasAnyIncome?: boolean;
	emptyExpensesJumpTarget?: EmptyExpensesJumpTarget | null;
	onJumpToEmptyExpensesTarget?: (target: EmptyExpensesJumpTarget) => void;
};

export type DeleteExpenseScopeOptions = {
	applyRemainingMonths: boolean;
	applyFutureYears: boolean;
};

export type DeleteExpenseModalProps = {
	open: boolean;
	expenseName?: string;
	errorMessage?: string | null;
	isBusy?: boolean;
	initialScope?: DeleteExpenseScopeOptions;
	onClose: () => void;
	onConfirm: (scope: DeleteExpenseScopeOptions) => void;
};

export type EditExpenseModalProps = {
	open: boolean;
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	payDate: number;
	categories: ExpenseCategoryOption[];
	expense: ExpenseItem | null;
	isBusy?: boolean;
	onClose: () => void;
	onSubmit: (formData: FormData) => void;
};

export type ExpenseManagerToolbarProps = {
	subtitle?: string;
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	statusFilter: ExpenseStatusFilter;
	onStatusFilterChange: (value: ExpenseStatusFilter) => void;
	minAmountFilter: number | null;
	onMinAmountFilterChange: (value: number | null) => void;
	showAddForm: boolean;
	onToggleAddForm: () => void;
	isDisabled?: boolean;
};

export type AddExpenseFormProps = {
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	categories: ExpenseCategoryOption[];
	creditCards?: CreditCardOption[];
	creditCardsByPlan?: Record<string, CreditCardOption[]>;
	debts?: DebtOption[];
	debtsByPlan?: Record<string, DebtOption[]>;
	allPlans?: ExpenseBudgetPlanOption[];
	allCategoriesByPlan?: Record<string, ExpenseCategoryOption[]>;
	horizonYearsByPlan?: Record<string, number>;
	budgetHorizonYears?: number;
	payDate: number;
	isBusy?: boolean;
	onAdded: () => void;
	onError: (message: string) => void;
};

export type ExpenseCardProps = {
	expense: ExpenseItem;
	category?: ExpenseCategoryOption;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	paymentValue?: string;
	onPaymentValueChange: (value: string) => void;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
};

export type ExpensesByCategoryProps = {
	expenses: ExpenseItem[];
	categories: ExpenseCategoryOption[];
	collapsedCategories: Record<string, boolean>;
	onToggleCategory: (key: string) => void;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	paymentByExpenseId: Record<string, string>;
	onPaymentValueChange: (expenseId: string, value: string) => void;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
};
