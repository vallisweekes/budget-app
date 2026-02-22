"use client";

import type { ExpenseManagerProps } from "@/types/expenses-manager";
import { addExpenseAction, applyExpensePaymentAction, removeExpenseAction, togglePaidAction, updateExpenseAction } from "./actions";
import ExpenseManagerView from "@/components/Expenses/ExpenseManager/ExpenseManagerView";
import { useExpenseManager } from "@/components/Expenses/ExpenseManager/useExpenseManager";

export default function ExpenseManager({
	...props
}: ExpenseManagerProps) {
	const logic = useExpenseManager({
		budgetPlanId: props.budgetPlanId,
		initialOpenCategoryId: props.initialOpenCategoryId,
		month: props.month,
		year: props.year,
		expenses: props.expenses,
		categories: props.categories,
		loading: props.loading,
		actions: {
			addExpenseAction,
			applyExpensePaymentAction,
			removeExpenseAction,
			togglePaidAction,
			updateExpenseAction,
		},
	});

	return <ExpenseManagerView {...props} {...logic} />;
}
