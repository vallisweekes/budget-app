"use client";

import { useEffect, useState } from "react";
import type { ExpenseItem, MonthKey } from "@/types";
import type { ExpenseManagerActions } from "@/types/expense-manager-actions";
import {
	useExpenseManagerMutationsCrud,
	type UseExpenseManagerMutationsCrudResult,
} from "@/components/Expenses/ExpenseManager/useExpenseManagerMutationsCrud";
import {
	useExpenseManagerMutationsPayments,
	type UseExpenseManagerMutationsPaymentsResult,
} from "@/components/Expenses/ExpenseManager/useExpenseManagerMutationsPayments";

export type UseExpenseManagerMutationsResult = {
	optimisticExpenses: ExpenseItem[];
	isPending: boolean;
} & Omit<UseExpenseManagerMutationsCrudResult, "isPending"> &
	Omit<UseExpenseManagerMutationsPaymentsResult, "isPending">;

export function useExpenseManagerMutations(args: {
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	expenses: ExpenseItem[];
	isPeriodLoading: boolean;
	actions: ExpenseManagerActions;
}): UseExpenseManagerMutationsResult {
	const { budgetPlanId, month, year, expenses, isPeriodLoading, actions } = args;
	const [optimisticExpenses, setOptimisticExpenses] = useState<ExpenseItem[]>(expenses);
	useEffect(() => {
		setOptimisticExpenses(expenses);
	}, [expenses]);

	const payments = useExpenseManagerMutationsPayments({
		budgetPlanId,
		month,
		year,
		optimisticExpenses,
		setOptimisticExpenses,
		actions: {
			togglePaidAction: actions.togglePaidAction,
			applyExpensePaymentAction: actions.applyExpensePaymentAction,
		},
	});

	const crud = useExpenseManagerMutationsCrud({
		budgetPlanId,
		month,
		year,
		isPeriodLoading,
		optimisticExpenses,
		setOptimisticExpenses,
		actions: {
			addExpenseAction: actions.addExpenseAction,
			updateExpenseAction: actions.updateExpenseAction,
			removeExpenseAction: actions.removeExpenseAction,
		},
	});

	const { isPending: isPendingPayments, ...paymentsRest } = payments;
	const { isPending: isPendingCrud, ...crudRest } = crud;

	return {
		optimisticExpenses,
		isPending: isPendingPayments || isPendingCrud,
		...paymentsRest,
		...crudRest,
	};
}
