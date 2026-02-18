"use client";

import { useCallback, useState, useTransition } from "react";
import type { MonthKey } from "@/types";
import { useRouter } from "next/navigation";
import { removeIncomeAction } from "@/lib/income/actions";

export function useDeleteIncomeButton(params: {
	id: string;
	budgetPlanId: string;
	year: number;
	month: MonthKey;
}) {
	const { id, budgetPlanId, year, month } = params;
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isOpen, setIsOpen] = useState(false);

	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const confirm = useCallback(() => {
		startTransition(async () => {
			await removeIncomeAction(budgetPlanId, year, month, id);
			setIsOpen(false);
			router.refresh();
		});
	}, [budgetPlanId, id, month, router, startTransition, year]);

	return { isPending, isOpen, open, close, confirm };
}
