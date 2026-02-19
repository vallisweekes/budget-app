"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Shared";
import { updateDebtAction } from "@/lib/debts/actions";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";
import type { DebtCardDebt } from "@/types/components/debts";
import {
	buildDebtUpdateFormData,
	canDeleteDebt,
	computeInstallmentDueAmount,
	getDaysUntilPayday,
	getPaymentMonthKeyUTC,
	getPercentPaid,
	isNearPaydayDebt,
} from "@/lib/helpers/debts/debtCard";

export function useDebtCard(params: { debt: DebtCardDebt; budgetPlanId: string; payDate: number }) {
	const { debt, budgetPlanId, payDate } = params;
	const toast = useToast();

	const [isPending, startTransition] = useTransition();
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [isEditingAmount, setIsEditingAmount] = useState(false);
	const [paymentSource, setPaymentSource] = useState(() => debt.defaultPaymentSource ?? "income");
	const [paymentCardDebtId, setPaymentCardDebtId] = useState(() =>
		(debt.defaultPaymentSource === "credit_card" ? debt.defaultPaymentCardDebtId : undefined) ?? ""
	);

	const [editName, setEditName] = useState(debt.name);
	const [editDueDay, setEditDueDay] = useState(debt.dueDay ? String(debt.dueDay) : "");
	const [editDefaultPaymentSource, setEditDefaultPaymentSource] = useState(debt.defaultPaymentSource ?? "income");
	const [editDefaultPaymentCardDebtId, setEditDefaultPaymentCardDebtId] = useState(debt.defaultPaymentCardDebtId ?? "");
	const [editInitialBalance, setEditInitialBalance] = useState(String(debt.initialBalance));
	const [editCurrentBalance, setEditCurrentBalance] = useState(String(debt.currentBalance));
	const [editDueAmount, setEditDueAmount] = useState(String(debt.amount));
	const [tempDueAmount, setTempDueAmount] = useState(String(debt.amount));
	const [editMonthlyMinimum, setEditMonthlyMinimum] = useState(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
	const [editInterestRate, setEditInterestRate] = useState(debt.interestRate ? String(debt.interestRate) : "");
	const [editInstallmentMonths, setEditInstallmentMonths] = useState(
		debt.installmentMonths ? String(debt.installmentMonths) : ""
	);

	const payday = useMemo(() => {
		const now = new Date();
		const daysUntil = getDaysUntilPayday(now, payDate);
		return { daysUntilPayday: daysUntil, isNearPayday: isNearPaydayDebt(debt, daysUntil) };
	}, [debt, payDate]);

	const derived = useMemo(() => {
		return {
			canDeleteDebt: canDeleteDebt(debt),
			effectiveMonthlyPayment: getDebtMonthlyPayment(debt),
			percentPaid: getPercentPaid(debt),
			paymentMonth: getPaymentMonthKeyUTC(),
		};
	}, [debt]);

	const handleEdit = () => {
		setEditName(debt.name);
		setEditDueDay(debt.dueDay ? String(debt.dueDay) : "");
		setEditDefaultPaymentSource(debt.defaultPaymentSource ?? "income");
		setEditDefaultPaymentCardDebtId(debt.defaultPaymentCardDebtId ?? "");
		setEditInitialBalance(String(debt.initialBalance));
		setEditCurrentBalance(String(debt.currentBalance));
		setEditDueAmount(String(debt.amount));
		setTempDueAmount(String(debt.amount));
		setEditMonthlyMinimum(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
		setEditInterestRate(debt.interestRate ? String(debt.interestRate) : "");
		setEditInstallmentMonths(debt.installmentMonths ? String(debt.installmentMonths) : "");
		setIsEditingAmount(false);
		setIsCollapsed(false);
		setIsEditing(true);
	};

	const handleCancel = () => {
		setIsEditing(false);
	};

	const handleSave = () => {
		const formData = buildDebtUpdateFormData({
			budgetPlanId,
			name: editName,
			dueDay: editDueDay,
			defaultPaymentSource: editDefaultPaymentSource,
			defaultPaymentCardDebtId: editDefaultPaymentCardDebtId,
			initialBalance: editInitialBalance,
			currentBalance: editCurrentBalance,
			amount: editDueAmount,
			monthlyMinimum: editMonthlyMinimum || undefined,
			interestRate: editInterestRate || undefined,
			installmentMonths: editInstallmentMonths || undefined,
		});

		startTransition(async () => {
			try {
				await updateDebtAction(debt.id, formData);
				setIsEditing(false);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Could not update debt.");
				console.error("Failed to update debt:", err);
			}
		});
	};

	const handleSaveDueAmount = () => {
		const formData = buildDebtUpdateFormData({
			budgetPlanId,
			name: debt.name,
			dueDay: debt.dueDay ? String(debt.dueDay) : "",
			defaultPaymentSource: debt.defaultPaymentSource ?? "income",
			defaultPaymentCardDebtId: debt.defaultPaymentCardDebtId ?? "",
			initialBalance: String(debt.initialBalance),
			currentBalance: String(debt.currentBalance),
			amount: tempDueAmount,
			monthlyMinimum: debt.monthlyMinimum ? String(debt.monthlyMinimum) : undefined,
			interestRate: debt.interestRate ? String(debt.interestRate) : undefined,
			installmentMonths: debt.installmentMonths ? String(debt.installmentMonths) : undefined,
		});

		startTransition(async () => {
			try {
				await updateDebtAction(debt.id, formData);
				setIsEditingAmount(false);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Could not update debt.");
				console.error("Failed to update debt amount:", err);
			}
		});
	};

	const handleSelectInstallmentMonths = (months: number) => {
		setEditInstallmentMonths(months === 0 ? "" : String(months));
		const currentBalance = parseFloat(editCurrentBalance);
		if (months > 0 && Number.isFinite(currentBalance) && currentBalance > 0) {
			const monthlyMinimum = editMonthlyMinimum ? parseFloat(editMonthlyMinimum) : undefined;
			const effective = computeInstallmentDueAmount({
				currentBalance,
				installmentMonths: months,
				monthlyMinimum: monthlyMinimum && Number.isFinite(monthlyMinimum) ? monthlyMinimum : undefined,
			});
			setEditDueAmount(effective.toFixed(2));
		}
	};

	return {
		isPending,
		isCollapsed,
		setIsCollapsed,
		isEditing,
		setIsEditing,
		isEditingAmount,
		setIsEditingAmount,
		paymentSource,
		setPaymentSource,
		paymentCardDebtId,
		setPaymentCardDebtId,

		editName,
		setEditName,
		editDueDay,
		setEditDueDay,
		editDefaultPaymentSource,
		setEditDefaultPaymentSource,
		editDefaultPaymentCardDebtId,
		setEditDefaultPaymentCardDebtId,
		editInitialBalance,
		setEditInitialBalance,
		editCurrentBalance,
		setEditCurrentBalance,
		editDueAmount,
		setEditDueAmount,
		tempDueAmount,
		setTempDueAmount,
		editMonthlyMinimum,
		setEditMonthlyMinimum,
		editInterestRate,
		setEditInterestRate,
		editInstallmentMonths,
		setEditInstallmentMonths,

		derived,
		payday,

		handleEdit,
		handleCancel,
		handleSave,
		handleSaveDueAmount,
		handleSelectInstallmentMonths,
	};
}
