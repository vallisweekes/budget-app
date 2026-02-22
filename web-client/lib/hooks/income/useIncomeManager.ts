"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { MonthKey, IncomeItem } from "@/types";
import { useRouter } from "next/navigation";
import { addIncomeAction, updateIncomeItemAction } from "@/lib/income/actions";
import { getIncomeMonthState } from "@/lib/helpers/income/monthState";

export function useIncomeManager(params: {
	year: number;
	month: MonthKey;
	incomeItems: IncomeItem[];
	budgetPlanId: string;
	onOpen: () => void;
	onClose: () => void;
}) {
	const { year, month, incomeItems, budgetPlanId, onOpen, onClose } = params;
	const router = useRouter();
	const state = useMemo(() => getIncomeMonthState({ year, month }), [year, month]);

	const [isPending, startTransition] = useTransition();
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);

	const [editName, setEditName] = useState("");
	const [editAmount, setEditAmount] = useState("");
	const [newName, setNewName] = useState("");
	const [newAmount, setNewAmount] = useState("");
	const [distributeAllMonths, setDistributeAllMonths] = useState(false);
	const [distributeAllYears, setDistributeAllYears] = useState(false);

	const handleEditClick = useCallback(
		(id: string) => {
			if (state.isLocked) return;
			const item = incomeItems.find((i) => i.id === id);
			if (item) {
				setEditName(item.name);
				setEditAmount(item.amount.toString());
			}
			setEditingItemId(id);
			onOpen();
		},
		[incomeItems, onOpen, state.isLocked]
	);

	const handleCancel = useCallback(() => {
		setEditingItemId(null);
		setIsAdding(false);
		onClose();
	}, [onClose]);

	const handleAddClick = useCallback(() => {
		if (!state.canAddForMonth) return;
		setNewName("");
		setNewAmount("");
		setDistributeAllMonths(false);
		setDistributeAllYears(false);
		setIsAdding(true);
		onOpen();
	}, [onOpen, state.canAddForMonth]);

	const handleConfirmAdd = useCallback(() => {
		if (!state.canAddForMonth) return;
		const name = newName.trim();
		const amount = Number(newAmount);
		if (!name) return;
		if (!Number.isFinite(amount) || amount <= 0) return;

		startTransition(async () => {
			const formData = new FormData();
			formData.set("budgetPlanId", budgetPlanId);
			formData.set("year", String(year));
			formData.set("month", month);
			formData.set("name", name);
			formData.set("amount", String(amount));
			if (distributeAllMonths) formData.set("distributeMonths", "on");
			if (distributeAllYears) formData.set("distributeYears", "on");
			await addIncomeAction(formData);
			setIsAdding(false);
			onClose();
			router.refresh();
		});
	}, [budgetPlanId, distributeAllMonths, distributeAllYears, month, newAmount, newName, onClose, router, state.canAddForMonth, startTransition, year]);

	const handleSubmitEdit = useCallback(
		(itemId: string) => {
			if (!editName.trim() || !editAmount) return;
			startTransition(async () => {
				await updateIncomeItemAction(budgetPlanId, year, month, itemId, editName, parseFloat(editAmount));
				setEditingItemId(null);
				onClose();
				router.refresh();
			});
		},
		[budgetPlanId, editAmount, editName, month, onClose, router, startTransition, year]
	);

	return {
		...state,
		isPending,
		editingItemId,
		isAdding,
		editName,
		editAmount,
		newName,
		newAmount,
		distributeAllMonths,
		distributeAllYears,
		setEditName,
		setEditAmount,
		setNewName,
		setNewAmount,
		setDistributeAllMonths,
		setDistributeAllYears,
		handleEditClick,
		handleCancel,
		handleAddClick,
		handleConfirmAdd,
		handleSubmitEdit,
	};
}
