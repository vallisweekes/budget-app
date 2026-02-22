"use client";

import { useMemo } from "react";
import type { DebtCardDebt } from "@/types/components/debts";
import { buildDebtListItems, type DebtListItem, type DebtSortOption } from "@/lib/helpers/debts/listItems";

export function useDebtListItems(debts: DebtCardDebt[], sortBy: DebtSortOption): DebtListItem[] {
	return useMemo(() => buildDebtListItems(debts, sortBy), [debts, sortBy]);
}
