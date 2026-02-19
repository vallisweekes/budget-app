"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseItem, MonthKey } from "@/types";
import { useToast } from "@/components/Shared";
import type { ExpenseManagerActions } from "@/types/expense-manager-actions";
import { optimisticApplyPayment, optimisticTogglePaid } from "@/lib/client/expenses/optimisticExpenseUpdates";

export type UseExpenseManagerMutationsPaymentsResult = {
	isPending: boolean;
	paymentByExpenseId: Record<string, string>;
	setPaymentByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	paymentSourceByExpenseId: Record<string, string>;
	setPaymentSourceByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	cardDebtIdByExpenseId: Record<string, string>;
	setCardDebtIdByExpenseId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
	handleTogglePaid: (expenseId: string) => void;
	handleApplyPayment: (expenseId: string) => void;
};

export function useExpenseManagerMutationsPayments(args: {
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	optimisticExpenses: ExpenseItem[];
	setOptimisticExpenses: (next: ExpenseItem[] | ((prev: ExpenseItem[]) => ExpenseItem[])) => void;
	actions: Pick<ExpenseManagerActions, "togglePaidAction" | "applyExpensePaymentAction">;
}): UseExpenseManagerMutationsPaymentsResult {
	const { budgetPlanId, month, year, optimisticExpenses, setOptimisticExpenses, actions } = args;
	const router = useRouter();
	const toast = useToast();
	const [isPending, startTransition] = useTransition();
	const [paymentByExpenseId, setPaymentByExpenseIdState] = useState<Record<string, string>>({});
	const [paymentSourceByExpenseId, setPaymentSourceByExpenseIdState] = useState<Record<string, string>>({});
	const [cardDebtIdByExpenseId, setCardDebtIdByExpenseIdState] = useState<Record<string, string>>({});

	const setPaymentByExpenseId = (updater: (prev: Record<string, string>) => Record<string, string>) => {
		setPaymentByExpenseIdState((prev) => updater(prev));
	};

	const setPaymentSourceByExpenseId = (updater: (prev: Record<string, string>) => Record<string, string>) => {
		setPaymentSourceByExpenseIdState((prev) => updater(prev));
	};

	const setCardDebtIdByExpenseId = (updater: (prev: Record<string, string>) => Record<string, string>) => {
		setCardDebtIdByExpenseIdState((prev) => updater(prev));
	};

	const handleTogglePaid = (expenseId: string) => {
		const paymentSource = paymentSourceByExpenseId[expenseId] ?? "income";
		const cardDebtId = cardDebtIdByExpenseId[expenseId] || undefined;
		const { next, prevSnapshot } = optimisticTogglePaid({ expenses: optimisticExpenses, expenseId });
		if (!prevSnapshot) return;
		setOptimisticExpenses(next);

		startTransition(async () => {
			try {
				await actions.togglePaidAction(budgetPlanId, month, expenseId, year, paymentSource, cardDebtId);
				router.refresh();
			} catch (err) {
				setOptimisticExpenses((prev) => prev.map((e) => (e.id === expenseId ? prevSnapshot : e)));
				toast.error(err instanceof Error ? err.message : "Could not update paid status.");
				console.error("Failed to toggle paid:", err);
			}
		});
	};

	const handleApplyPayment = (expenseId: string) => {
		const raw = paymentByExpenseId[expenseId];
		const paymentAmount = Number(raw);
		if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return;
		const paymentSource = paymentSourceByExpenseId[expenseId] ?? "income";
		const cardDebtId = cardDebtIdByExpenseId[expenseId] || undefined;

		const { next, prevSnapshot } = optimisticApplyPayment({ expenses: optimisticExpenses, expenseId, paymentAmount });
		setOptimisticExpenses(next);

		startTransition(async () => {
			try {
				const res = await actions.applyExpensePaymentAction(
					budgetPlanId,
					month,
					expenseId,
					paymentAmount,
					year,
					paymentSource,
					cardDebtId
				);
				if (!res?.success) {
					if (prevSnapshot) {
						setOptimisticExpenses((prev) => prev.map((e) => (e.id === prevSnapshot.id ? prevSnapshot : e)));
					}
					toast.error(res?.error ?? "Could not apply payment.");
					return;
				}
				router.refresh();
			} catch (err) {
				if (prevSnapshot) {
					setOptimisticExpenses((prev) => prev.map((e) => (e.id === prevSnapshot.id ? prevSnapshot : e)));
				}
				toast.error(err instanceof Error ? err.message : "Could not apply payment.");
				console.error("Failed to apply payment:", err);
			}
		});

		setPaymentByExpenseIdState((prev) => ({ ...prev, [expenseId]: "" }));
	};

	return {
		isPending,
		paymentByExpenseId,
		setPaymentByExpenseId,
		paymentSourceByExpenseId,
		setPaymentSourceByExpenseId,
		cardDebtIdByExpenseId,
		setCardDebtIdByExpenseId,
		handleTogglePaid,
		handleApplyPayment,
	};
}
