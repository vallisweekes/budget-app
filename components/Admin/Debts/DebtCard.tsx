"use client";

import { CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
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
	const Icon = typeIcons[debt.type as keyof typeof typeIcons];

	const {
		isPending,
		isCollapsed,
		setIsCollapsed,
		isEditing,
		isEditingAmount,
		setIsEditingAmount,
		paymentSource,
		setPaymentSource,
		editName,
		setEditName,
		editCreditLimit,
		setEditCreditLimit,
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
	} = useDebtCard({ debt, budgetPlanId, payDate });

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

			{isCollapsed && !isEditing ? <DebtCardCollapsedSummary debt={debt} percentPaid={derived.percentPaid} /> : null}

			{!isCollapsed ? (
				isEditing ? (
					<DebtCardEditDetails
						debtType={debt.type}
						editCreditLimit={editCreditLimit}
						onEditCreditLimitChange={setEditCreditLimit}
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
						paymentSource={paymentSource}
						onPaymentSourceChange={setPaymentSource}
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
