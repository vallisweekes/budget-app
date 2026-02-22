"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseItem, MonthKey } from "@/types";
import type { DeleteExpenseScopeOptions } from "@/types/expenses-manager";
import { useToast } from "@/components/Shared";
import type { ExpenseManagerActions } from "@/types/expense-manager-actions";
import { optimisticEditExpense } from "@/lib/client/expenses/optimisticExpenseUpdates";

export type UseExpenseManagerMutationsCrudResult = {
	isPending: boolean;
	showAddForm: boolean;
	setShowAddForm: (value: boolean | ((prev: boolean) => boolean)) => void;
	onAddedExpense: () => void;
	onAddError: (message: string) => void;

	expensePendingDelete: ExpenseItem | null;
	deleteError: string | null;
	handleRemoveClick: (expense: ExpenseItem) => void;
	confirmRemove: (scope: DeleteExpenseScopeOptions) => void;
	closeDelete: () => void;

	expensePendingEdit: ExpenseItem | null;
	handleEditClick: (expense: ExpenseItem) => void;
	handleEditSubmit: (data: FormData) => void;
	closeEdit: () => void;

	inlineAddCategoryId: string | null;
	inlineAddError: string | null;
	openInlineAdd: (categoryId: string) => void;
	closeInlineAdd: () => void;
	handleInlineAddSubmit: (data: FormData) => void;
};

export function useExpenseManagerMutationsCrud(args: {
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	isPeriodLoading: boolean;
	optimisticExpenses: ExpenseItem[];
	setOptimisticExpenses: (next: ExpenseItem[] | ((prev: ExpenseItem[]) => ExpenseItem[])) => void;
	actions: Pick<ExpenseManagerActions, "addExpenseAction" | "updateExpenseAction" | "removeExpenseAction">;
}): UseExpenseManagerMutationsCrudResult {
	const { budgetPlanId, month, year, isPeriodLoading, optimisticExpenses, setOptimisticExpenses, actions } = args;
	const router = useRouter();
	const toast = useToast();
	const [isPending, startTransition] = useTransition();

	const [showAddForm, setShowAddForm] = useState(false);
	const [expensePendingDelete, setExpensePendingDelete] = useState<ExpenseItem | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [expensePendingEdit, setExpensePendingEdit] = useState<ExpenseItem | null>(null);
	const [inlineAddCategoryId, setInlineAddCategoryId] = useState<string | null>(null);
	const [inlineAddError, setInlineAddError] = useState<string | null>(null);

	const handleRemoveClick = (expense: ExpenseItem) => {
		setDeleteError(null);
		setExpensePendingDelete(expense);
	};

	const confirmRemove = (scope: DeleteExpenseScopeOptions) => {
		const expense = expensePendingDelete;
		if (!expense) return;
		const prevSnapshot = [...optimisticExpenses];
		setOptimisticExpenses((prev) => prev.filter((e) => e.id !== expense.id));
		setDeleteError(null);

		startTransition(async () => {
			try {
				await actions.removeExpenseAction(budgetPlanId, month, expense.id, year, scope);
				setExpensePendingDelete(null);
				router.refresh();
			} catch (err) {
				const message = err instanceof Error ? err.message : "Could not delete expense.";
				setDeleteError(message);
				setOptimisticExpenses(prevSnapshot);
				toast.error(message);
				console.error("Failed to delete expense:", err);
			}
		});
	};

	const closeDelete = () => {
		if (!isPending) setExpensePendingDelete(null);
	};

	const handleEditClick = (expense: ExpenseItem) => {
		setExpensePendingEdit(expense);
	};

	const handleEditSubmit = (data: FormData) => {
		if (isPending) return;
		const { next, prevSnapshot } = optimisticEditExpense({ expenses: optimisticExpenses, data });
		setOptimisticExpenses(next);

		startTransition(async () => {
			try {
				await actions.updateExpenseAction(data);
				setExpensePendingEdit(null);
				router.refresh();
			} catch (err) {
				if (prevSnapshot) {
					setOptimisticExpenses((prev) => prev.map((ex) => (ex.id === prevSnapshot.id ? prevSnapshot : ex)));
				}
				toast.error(err instanceof Error ? err.message : "Could not update expense.");
				console.error("Failed to update expense:", err);
			}
		});
	};

	const closeEdit = () => {
		if (!isPending) setExpensePendingEdit(null);
	};

	const handleInlineAddSubmit = (data: FormData) => {
		if (isPeriodLoading) return;
		setInlineAddError(null);
		startTransition(async () => {
			try {
				await actions.addExpenseAction(data);
				setInlineAddCategoryId(null);
				router.refresh();
			} catch {
				setInlineAddError("Could not add expense. Please try again.");
			}
		});
	};

	const openInlineAdd = (categoryId: string) => {
		setInlineAddError(null);
		setInlineAddCategoryId(categoryId);
	};

	const closeInlineAdd = () => {
		setInlineAddCategoryId(null);
	};

	const onAddedExpense = () => {
		setShowAddForm(false);
		router.refresh();
	};

	const onAddError = (message: string) => toast.error(message);

	return {
		isPending,
		showAddForm,
		setShowAddForm,
		onAddedExpense,
		onAddError,
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
	};
}
