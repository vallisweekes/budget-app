"use client";

import { CreditCard, TrendingDown, ShoppingBag, Home } from "lucide-react";
import DebtCardHeader from "./DebtCardHeader";
import DebtCardCollapsedSummary from "./DebtCardCollapsedSummary";
import DebtCardEditDetails from "./DebtCardEditDetails";
import DebtCardViewDetails from "./DebtCardViewDetails";
import DebtCardPaydayNotice from "./DebtCardPaydayNotice";
import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "@/types";
import { useDebtCard } from "@/lib/hooks/debts/useDebtCard";

interface DebtCardProps {
	debt: DebtCardDebt;
	creditCards: DebtCardDebt[];
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	payments: DebtPayment[];
	payDate: number;
	defaultExpanded?: boolean;
}

const typeIcons = {
	credit_card: CreditCard,
	store_card: ShoppingBag,
	loan: TrendingDown,
	mortgage: Home,
	hire_purchase: ShoppingBag,
	other: TrendingDown,
} as const;

export default function DebtCard({ debt, creditCards, budgetPlanId, typeLabels, payments, payDate, defaultExpanded }: DebtCardProps) {
	const Icon = typeIcons[debt.type as keyof typeof typeIcons] ?? CreditCard;
	const creditCardOptions = creditCards
		.filter((d) => d.id !== debt.id)
		.map((d) => ({ value: d.id, label: d.name }));

	const {
		isPending,
		isCollapsed,
		setIsCollapsed,
		isEditing,
		isEditingAmount,
		setIsEditingAmount,
		paymentSource,
		setPaymentSource,
		paymentCardDebtId,
		setPaymentCardDebtId,
		editName,
		setEditName,
		editDueDate,
		setEditDueDate,
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
		derived,
		payday,
		handleEdit,
		handleCancel,
		handleSave,
		handleSaveDueAmount,
		handleSelectInstallmentMonths,
	} = useDebtCard({ debt, budgetPlanId, payDate, defaultExpanded });

	return (
		<div className={`bg-slate-800/40 backdrop-blur-xl rounded-xl sm:rounded-2xl border p-3 sm:p-5 hover:border-white/20 transition-all ${
			payday.isNearPayday ? "border-amber-500/50 shadow-lg shadow-amber-500/20" : "border-white/10"
		}`}>
			{payday.isNearPayday ? <DebtCardPaydayNotice daysUntilPayday={payday.daysUntilPayday} /> : null}
			<DebtCardHeader
				debt={debt}
				Icon={Icon}
				typeLabels={typeLabels}
				canDeleteDebt={derived.canDeleteDebt}
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

			{isCollapsed && !isEditing ? (
				<DebtCardCollapsedSummary
					debt={debt}
					percentPaid={derived.percentPaid}
					payments={payments}
					paymentMonth={derived.paymentMonth}
				/>
			) : null}

			{!isCollapsed ? (
				isEditing ? (
					<DebtCardEditDetails
						debtType={debt.type}
						creditLimit={debt.creditLimit ? String(debt.creditLimit) : ""}
						editDueDate={editDueDate}
						onEditDueDateChange={setEditDueDate}
						editDefaultPaymentSource={editDefaultPaymentSource}
						onEditDefaultPaymentSourceChange={(next) => setEditDefaultPaymentSource(next as any)}
						editDefaultPaymentCardDebtId={editDefaultPaymentCardDebtId}
						onEditDefaultPaymentCardDebtIdChange={setEditDefaultPaymentCardDebtId}
						creditCardOptions={creditCardOptions}
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
						paymentMonth={derived.paymentMonth}
						onRequestEditInstallment={(months) => {
							handleEdit();
							handleSelectInstallmentMonths(months);
						}}
						paymentSource={paymentSource}
						onPaymentSourceChange={(next) => setPaymentSource(next as any)}
						paymentCardDebtId={paymentCardDebtId}
						onPaymentCardDebtIdChange={setPaymentCardDebtId}
						creditCardOptions={creditCardOptions}
						isEditingAmount={isEditingAmount}
						onEditingAmountChange={setIsEditingAmount}
						tempDueAmount={tempDueAmount}
						onTempDueAmountChange={setTempDueAmount}
						onSaveDueAmount={handleSaveDueAmount}
						isPending={isPending}
						effectiveMonthlyPayment={derived.effectiveMonthlyPayment}
						percentPaid={derived.percentPaid}
					/>
				)
			) : null}
		</div>
	);
}
