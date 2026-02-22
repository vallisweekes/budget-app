"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { deleteDebtAction } from "@/lib/debts/actions";

export function useDeleteDebtButton(params: { debtId: string; budgetPlanId?: string }) {
	const { debtId, budgetPlanId } = params;
	const [isPending, startTransition] = useTransition();
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const searchParams = useSearchParams();

	const planId = useMemo(() => {
		return budgetPlanId ?? searchParams.get("plan") ?? "";
	}, [budgetPlanId, searchParams]);

	const open = useCallback(() => setConfirmingDelete(true), []);
	const close = useCallback(() => {
		if (!isPending) setConfirmingDelete(false);
	}, [isPending]);

	const confirm = useCallback(() => {
		startTransition(async () => {
			if (!planId) return;
			await deleteDebtAction(planId, debtId);
		});
		setConfirmingDelete(false);
	}, [debtId, planId, startTransition]);

	return {
		isPending,
		confirmingDelete,
		open,
		close,
		confirm,
	};
}
