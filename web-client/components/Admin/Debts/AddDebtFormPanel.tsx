"use client";

import { X } from "lucide-react";
import Link from "next/link";

import AddDebtFormFieldsGrid from "@/components/Admin/Debts/AddDebtFormFieldsGrid";

export interface AddDebtFormPanelProps {
	budgetPlanId: string;
	settingsHref: string;
	creditCards: Array<{ id: string; name: string }>;
	type: string;
	onTypeChange: (next: string) => void;
	creditLimit: string;
	onCreditLimitChange: (next: string) => void;
	dueDate: string;
	onDueDateChange: (next: string) => void;
	defaultPaymentSource: string;
	onDefaultPaymentSourceChange: (next: string) => void;
	defaultPaymentCardDebtId: string;
	onDefaultPaymentCardDebtIdChange: (next: string) => void;
	initialBalance: string;
	onInitialBalanceChange: (next: string) => void;
	installmentMonths: string;
	onInstallmentMonthsChange: (next: string) => void;
	isCardType: boolean;
	onClose: () => void;
	onSubmit: (formData: FormData) => void | Promise<void>;
}

export default function AddDebtFormPanel({
	budgetPlanId,
	settingsHref,
	creditCards,
	type,
	onTypeChange,
	creditLimit,
	onCreditLimitChange,
	dueDate,
	onDueDateChange,
	defaultPaymentSource,
	onDefaultPaymentSourceChange,
	defaultPaymentCardDebtId,
	onDefaultPaymentCardDebtIdChange,
	initialBalance,
	onInitialBalanceChange,
	installmentMonths,
	onInstallmentMonthsChange,
	isCardType,
	onClose,
	onSubmit,
}: AddDebtFormPanelProps) {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-4 sm:p-6 mb-6 sm:mb-8">
			<div className="flex items-center justify-between mb-3 sm:mb-4">
				<h2 className="text-base sm:text-xl font-semibold text-white">Add New Debt</h2>
				<button
					onClick={onClose}
					className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
					aria-label="Close"
				>
					<X className="w-5 h-5 text-slate-400" />
				</button>
			</div>

			<form action={onSubmit} className="space-y-3 sm:space-y-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />

				<div className="text-xs sm:text-sm text-slate-400">
					You can add cards here (requires a credit limit) or in{" "}
					<Link
						href={settingsHref}
						className="text-purple-300 hover:text-purple-200 underline underline-offset-2"
					>
						Settings → Savings and Cards
					</Link>
					.
				</div>

				<AddDebtFormFieldsGrid
					creditCards={creditCards}
					type={type}
					onTypeChange={onTypeChange}
					creditLimit={creditLimit}
					onCreditLimitChange={onCreditLimitChange}
					dueDate={dueDate}
					onDueDateChange={onDueDateChange}
					defaultPaymentSource={defaultPaymentSource}
					onDefaultPaymentSourceChange={onDefaultPaymentSourceChange}
					defaultPaymentCardDebtId={defaultPaymentCardDebtId}
					onDefaultPaymentCardDebtIdChange={onDefaultPaymentCardDebtIdChange}
					initialBalance={initialBalance}
					onInitialBalanceChange={onInitialBalanceChange}
					installmentMonths={installmentMonths}
					onInstallmentMonthsChange={onInstallmentMonthsChange}
					isCardType={isCardType}
				/>

				<div className="flex gap-2 sm:gap-3">
					<button
						type="submit"
						className="flex-1 md:flex-initial px-4 py-2 sm:px-6 sm:py-3 bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white rounded-lg transition-colors font-medium shadow-lg hover:shadow-xl text-sm sm:text-base"
					>
						Add Debt
					</button>
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 sm:px-6 sm:py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium text-sm sm:text-base"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
