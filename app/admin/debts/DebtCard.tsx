"use client";

import { useMemo, useState, useTransition } from "react";
import { CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
import DebtCardHeader from "./DebtCardHeader";
import DebtCardCollapsedSummary from "./DebtCardCollapsedSummary";
import DebtCardEditDetails from "./DebtCardEditDetails";
import DebtCardViewDetails from "./DebtCardViewDetails";
import DebtCardPaydayNotice from "./DebtCardPaydayNotice";
import { updateDebtAction, makePaymentFromForm } from "@/lib/debts/actions";
import type { DebtPayment, DebtType } from "@/types";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";
import type { DebtCardDebt } from "./debtCardTypes";

interface DebtCardProps {
	debt: DebtCardDebt;
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	payments: DebtPayment[];
	payDate: number;
}

const typeIcons = {
	credit_card: CreditCard,
	loan: TrendingDown,
	high_purchase: ShoppingBag,
} as const;

export default function DebtCard({ debt, budgetPlanId, typeLabels, payments, payDate }: DebtCardProps) {
	const canDeleteDebt = !(debt.sourceType === "expense" && debt.currentBalance > 0);
	// Check if it's near payday (within 3 days before or on payday)
	const now = new Date();
	const currentDay = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const daysUntilPayday = payDate >= currentDay 
		? payDate - currentDay 
		: (daysInMonth - currentDay) + payDate;
	const isNearPayday = daysUntilPayday <= 3 && debt.amount > 0;

	const [isPending, startTransition] = useTransition();
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [isEditingAmount, setIsEditingAmount] = useState(false);
	const [paymentSource, setPaymentSource] = useState("income");
	const [editName, setEditName] = useState(debt.name);
	const [editInitialBalance, setEditInitialBalance] = useState(String(debt.initialBalance));
	const [editCurrentBalance, setEditCurrentBalance] = useState(String(debt.currentBalance));
	const [editDueAmount, setEditDueAmount] = useState(String(debt.amount));
	const [tempDueAmount, setTempDueAmount] = useState(String(debt.amount));
	const [editMonthlyMinimum, setEditMonthlyMinimum] = useState(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
	const [editInterestRate, setEditInterestRate] = useState(debt.interestRate ? String(debt.interestRate) : "");
	const [editInstallmentMonths, setEditInstallmentMonths] = useState(debt.installmentMonths ? String(debt.installmentMonths) : "");

	const Icon = typeIcons[debt.type as keyof typeof typeIcons];
	
	// Calculate effective monthly payment considering installment plan and minimum
	const effectiveMonthlyPayment = getDebtMonthlyPayment(debt);
	
	const percentPaid = debt.initialBalance > 0
		? ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100
		: 0;

	const paymentMonth = useMemo(() => {
		const now = new Date();
		const y = now.getUTCFullYear();
		const m = String(now.getUTCMonth() + 1).padStart(2, "0");
		return `${y}-${m}`;
	}, []);

	const handleEdit = () => {
		setEditName(debt.name);
		setEditInitialBalance(String(debt.initialBalance));
		setEditCurrentBalance(String(debt.currentBalance));
		setEditDueAmount(String(debt.amount));
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

	const handleSave = async () => {
		const formData = new FormData();
		formData.append("budgetPlanId", budgetPlanId);
		formData.append("name", editName);
		formData.append("initialBalance", editInitialBalance);
		formData.append("currentBalance", editCurrentBalance);
		formData.append("amount", editDueAmount);
		if (editMonthlyMinimum) formData.append("monthlyMinimum", editMonthlyMinimum);
		if (editInterestRate) formData.append("interestRate", editInterestRate);
		if (editInstallmentMonths) formData.append("installmentMonths", editInstallmentMonths);

		startTransition(async () => {
			await updateDebtAction(debt.id, formData);
			setIsEditing(false);
		});
	};

	const handleSaveDueAmount = async () => {
		const formData = new FormData();
		formData.append("budgetPlanId", budgetPlanId);
		formData.append("name", debt.name);
		formData.append("initialBalance", String(debt.initialBalance));
		formData.append("currentBalance", String(debt.currentBalance));
		formData.append("amount", tempDueAmount);
		if (debt.monthlyMinimum) formData.append("monthlyMinimum", String(debt.monthlyMinimum));
		if (debt.interestRate) formData.append("interestRate", String(debt.interestRate));

		startTransition(async () => {
			await updateDebtAction(debt.id, formData);
			setIsEditingAmount(false);
		});
	};

	const handleSelectInstallmentMonths = (months: number) => {
		setEditInstallmentMonths(months === 0 ? "" : String(months));
		if (months > 0 && parseFloat(editCurrentBalance) > 0) {
			const monthlyAmount = parseFloat(editCurrentBalance) / months;
			const min = editMonthlyMinimum ? parseFloat(editMonthlyMinimum) : 0;
			const effective = Math.max(monthlyAmount, Number.isFinite(min) ? min : 0);
			setEditDueAmount(effective.toFixed(2));
		}
	};

	return (
		<div className={`bg-slate-800/40 backdrop-blur-xl rounded-xl sm:rounded-2xl border p-3 sm:p-5 hover:border-white/20 transition-all ${
			isNearPayday ? 'border-amber-500/50 shadow-lg shadow-amber-500/20' : 'border-white/10'
		}`}>
			{isNearPayday ? <DebtCardPaydayNotice daysUntilPayday={daysUntilPayday} /> : null}
			<DebtCardHeader
				debt={debt}
				Icon={Icon}
				typeLabels={typeLabels}
				canDeleteDebt={canDeleteDebt}
				isEditing={isEditing}
				isCollapsed={isCollapsed}
				editName={editName}
				isPending={isPending}
				onToggleCollapsed={() => setIsCollapsed((v) => !v)}
				onEditNameChange={setEditName}
				onEdit={handleEdit}
				onSave={handleSave}
				onCancel={handleCancel}
				budgetPlanId={budgetPlanId}
			/>

			{isCollapsed && !isEditing ? <DebtCardCollapsedSummary debt={debt} percentPaid={percentPaid} /> : null}

			{!isCollapsed ? (
				isEditing ? (
					<DebtCardEditDetails
						editInitialBalance={editInitialBalance}
						editCurrentBalance={editCurrentBalance}
						editDueAmount={editDueAmount}
						editMonthlyMinimum={editMonthlyMinimum}
						editInterestRate={editInterestRate}
						editInstallmentMonths={editInstallmentMonths}
						onEditInitialBalanceChange={setEditInitialBalance}
						onEditCurrentBalanceChange={setEditCurrentBalance}
						onEditDueAmountChange={setEditDueAmount}
						onEditMonthlyMinimumChange={setEditMonthlyMinimum}
						onEditInterestRateChange={setEditInterestRate}
						onSelectInstallmentMonths={handleSelectInstallmentMonths}
					/>
				) : (
					<DebtCardViewDetails
						debt={debt}
						payments={payments}
						budgetPlanId={budgetPlanId}
						paymentMonth={paymentMonth}
						paymentSource={paymentSource}
						onPaymentSourceChange={setPaymentSource}
						isEditingAmount={isEditingAmount}
						onEditingAmountChange={setIsEditingAmount}
						tempDueAmount={tempDueAmount}
						onTempDueAmountChange={setTempDueAmount}
						onSaveDueAmount={handleSaveDueAmount}
						isPending={isPending}
						effectiveMonthlyPayment={effectiveMonthlyPayment}
						percentPaid={percentPaid}
					/>
				)
			) : null}
		</div>
	);
}
