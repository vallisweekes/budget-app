"use client";

import { X } from "lucide-react";
import Link from "next/link";

import { SelectDropdown } from "@/components/Shared";
import InstallmentPlanSection from "@/components/Admin/Debts/InstallmentPlanSection";

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
}: {
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
}) {
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

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Name</label>
						<input
							type="text"
							name="name"
							placeholder="e.g., VANQUIS CARD"
							required
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Type</label>
						<SelectDropdown
							name="type"
							required
							value={type}
							onValueChange={onTypeChange}
							options={[
								{ value: "credit_card", label: "Credit Card" },
								{ value: "store_card", label: "Store Card" },
								{ value: "loan", label: "Loan" },
								{ value: "mortgage", label: "Mortgage" },
								{ value: "hire_purchase", label: "Hire Purchase" },
								{ value: "other", label: "Other" },
							]}
							buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
						/>
					</div>

					{isCardType ? (
						<div>
							<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
								Credit Limit
							</label>
							<input
								type="number"
								name="creditLimit"
								step="0.01"
								placeholder="1200.00"
								required
								value={creditLimit}
								onChange={(e) => onCreditLimitChange(e.target.value)}
								className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
							/>
							<div className="mt-1 text-[10px] sm:text-xs text-slate-500">Required for credit/store cards.</div>
						</div>
					) : (
						<input type="hidden" name="creditLimit" value="" />
					)}

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Due Date</label>
						<input
							type="date"
							name="dueDate"
							value={dueDate}
							onChange={(e) => onDueDateChange(e.target.value)}
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
						<div className="mt-1 text-[10px] sm:text-xs text-slate-500">
							Missed payment triggers 5 days after this date.
						</div>
					</div>

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
							Default Payment Source
						</label>
						<SelectDropdown
							name="defaultPaymentSource"
							required
							value={defaultPaymentSource}
							onValueChange={onDefaultPaymentSourceChange}
							options={[
								{ value: "income", label: "Income (tracked)" },
								{ value: "extra_funds", label: "Extra funds" },
								{ value: "credit_card", label: "Credit card" },
							]}
							buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
						/>
					</div>

					{defaultPaymentSource === "credit_card" ? (
						<div>
							<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
								Default Card
							</label>
							<SelectDropdown
								name="defaultPaymentCardDebtId"
								required
								value={defaultPaymentCardDebtId}
								onValueChange={onDefaultPaymentCardDebtIdChange}
								options={[
									{ value: "", label: "Choose a card" },
									...creditCards.map((c) => ({ value: c.id, label: c.name })),
								]}
								buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
							/>
						</div>
					) : (
						<input type="hidden" name="defaultPaymentCardDebtId" value="" />
					)}

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
							Initial Balance
						</label>
						<input
							type="number"
							name="initialBalance"
							step="0.01"
							placeholder="450.00"
							required
							value={initialBalance}
							onChange={(e) => onInitialBalanceChange(e.target.value)}
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
							Monthly Minimum (Optional)
						</label>
						<input
							type="number"
							name="monthlyMinimum"
							step="0.01"
							placeholder="25.00"
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>

					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
							Interest Rate % (Optional)
						</label>
						<input
							type="number"
							name="interestRate"
							step="0.01"
							placeholder="19.9"
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>
				</div>

				<InstallmentPlanSection
					installmentMonths={installmentMonths}
					onInstallmentMonthsChange={onInstallmentMonthsChange}
					initialBalance={initialBalance}
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
