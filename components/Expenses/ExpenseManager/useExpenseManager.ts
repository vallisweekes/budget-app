"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import type { ExpenseManagerProps } from "@/types/expenses-manager";
import type { ExpenseManagerActions } from "@/types/expense-manager-actions";
import { buildScopedPageHref } from "@/lib/helpers/scopedPageHref";
import { useExpenseManagerFilters } from "@/components/Expenses/ExpenseManager/useExpenseManagerFilters";
import { useExpenseManagerMutations } from "@/components/Expenses/ExpenseManager/useExpenseManagerMutations";

export type UseExpenseManagerResult = {
	incomeHref: string;
	isPeriodLoading: boolean;
} & ReturnType<typeof useExpenseManagerFilters> &
	ReturnType<typeof useExpenseManagerMutations>;

export function useExpenseManager(
	props: Pick<ExpenseManagerProps, "budgetPlanId" | "month" | "year" | "expenses" | "categories" | "loading"> & {
		actions: ExpenseManagerActions;
	}
): UseExpenseManagerResult {
	const { budgetPlanId, month, year, expenses, categories, loading, actions } = props;
	const pathname = usePathname();
	const isPeriodLoading = Boolean(loading);

	const incomeHref = useMemo(() => {
		return buildScopedPageHref(pathname, "income");
	}, [pathname]);

	const mutations = useExpenseManagerMutations({
		budgetPlanId,
		month,
		year,
		expenses,
		isPeriodLoading,
		actions,
	});

	const filters = useExpenseManagerFilters({ expenses: mutations.optimisticExpenses, categories });

	return {
		incomeHref,
		isPeriodLoading,
		...filters,
		...mutations,
	};
}
