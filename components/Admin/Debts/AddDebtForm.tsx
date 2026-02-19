"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SelectDropdown } from "@/components/Shared";
import Link from "next/link";
import { createNonCardDebtAction } from "@/lib/debts/actions";
import { formatCurrency } from "@/lib/helpers/money";

interface AddDebtFormProps {
	budgetPlanId: string;
	payDate: number;
	creditCards: Array<{ id: string; name: string }>;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function AddDebtForm({ budgetPlanId, payDate, creditCards }: AddDebtFormProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [type, setType] = useState("loan");
	const [initialBalance, setInitialBalance] = useState("");
	const [installmentMonths, setInstallmentMonths] = useState("");
	const defaultDueDate = (): string => {
		const now = new Date();
		const day = Number(payDate);
		if (!Number.isFinite(day) || day < 1 || day > 31) return "";
		const y = now.getUTCFullYear();
		const m = now.getUTCMonth();
		const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
		let candidate = new Date(Date.UTC(y, m, Math.min(day, dim)));
		if (candidate.getTime() < now.getTime()) {
			const ny = candidate.getUTCFullYear();
			const nm = candidate.getUTCMonth() + 1;
			const dim2 = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
			candidate = new Date(Date.UTC(ny, nm, Math.min(day, dim2)));
		}
		return candidate.toISOString().slice(0, 10);
	};

	const [dueDate, setDueDate] = useState(defaultDueDate());
	const [defaultPaymentSource, setDefaultPaymentSource] = useState("income");
	const [defaultPaymentCardDebtId, setDefaultPaymentCardDebtId] = useState("");

	const handleSubmit = async (formData: FormData) => {
		await createNonCardDebtAction(formData);
		setIsOpen(false);
		setType("loan");
		setInitialBalance("");
		setInstallmentMonths("");
		setDueDate(defaultDueDate());
		setDefaultPaymentSource("income");
		setDefaultPaymentCardDebtId("");
	};

	if (!isOpen) {
		return (
			<button
				onClick={() => setIsOpen(true)}
				className="w-full md:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl flex items-center gap-1.5 sm:gap-2 justify-center mb-6 sm:mb-8 text-sm sm:text-base"
			>
				<Plus className="w-4 h-4 sm:w-5 sm:h-5" />
				Add New Debt
			</button>
		);
	}

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-4 sm:p-6 mb-6 sm:mb-8">
			<div className="flex items-center justify-between mb-3 sm:mb-4">
				<h2 className="text-base sm:text-xl font-semibold text-white">Add New Debt</h2>
				<button
					onClick={() => setIsOpen(false)}
					className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
					aria-label="Close"
				>
					<X className="w-5 h-5 text-slate-400" />
				</button>
			</div>
			<form action={handleSubmit} className="space-y-3 sm:space-y-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<div className="text-xs sm:text-sm text-slate-400">
					Need to add a card? Do it in{" "}
					<Link href="/admin/settings" className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
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
							onValueChange={setType}
							options={[
								{ value: "loan", label: "Loan" },
								{ value: "mortgage", label: "Mortgage" },
								{ value: "high_purchase", label: "High Purchase" },
								{ value: "other", label: "Other" },
							]}
							buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
						/>
					</div>
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Due Date</label>
						<input
							type="date"
							name="dueDate"
							value={dueDate}
							onChange={(e) => setDueDate(e.target.value)}
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
						<div className="mt-1 text-[10px] sm:text-xs text-slate-500">Missed payment triggers 5 days after this date.</div>
					</div>
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Default Payment Source</label>
						<SelectDropdown
							name="defaultPaymentSource"
							required
							value={defaultPaymentSource}
							onValueChange={(next) => {
								setDefaultPaymentSource(next);
								if (next !== "credit_card") setDefaultPaymentCardDebtId("");
							}}
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
							<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Default Card</label>
							<SelectDropdown
								name="defaultPaymentCardDebtId"
								required
								value={defaultPaymentCardDebtId}
								onValueChange={setDefaultPaymentCardDebtId}
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
					<input type="hidden" name="creditLimit" value="" />
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Initial Balance</label>
						<input
							type="number"
							name="initialBalance"
							step="0.01"
							placeholder="450.00"
							required
							value={initialBalance}
							onChange={(e) => setInitialBalance(e.target.value)}
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Monthly Minimum (Optional)</label>
						<input
							type="number"
							name="monthlyMinimum"
							step="0.01"
							placeholder="25.00"
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>
					<div>
						<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">Interest Rate % (Optional)</label>
						<input
							type="number"
							name="interestRate"
							step="0.01"
							placeholder="19.9"
							className="w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
						/>
					</div>
				</div>

				<div>
					<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">Installment Plan (Optional)</label>
					<div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
						{[0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36].map((months) => (
							<button
								key={months}
								type="button"
								onClick={() => setInstallmentMonths(months === 0 ? "" : String(months))}
								className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
									(months === 0 && !installmentMonths) || installmentMonths === String(months)
										? "bg-purple-500 text-white"
										: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 border border-white/10"
								}`}
							>
								{months === 0 ? "None" : `${months} months`}
							</button>
						))}
					</div>
					<input type="hidden" name="installmentMonths" value={installmentMonths} />
					{installmentMonths && parseFloat(initialBalance) > 0 && (
						<div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
							<div className="text-sm text-purple-300">
								💡 Payment will be spread over {installmentMonths} months: <span className="font-bold">
									<Currency value={parseFloat(initialBalance) / parseFloat(installmentMonths)} />
								</span> per month
							</div>
						</div>
					)}
				</div>

				<div className="flex gap-2 sm:gap-3">
					<button
						type="submit"
						className="flex-1 md:flex-initial px-4 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl text-sm sm:text-base"
					>
						Add Debt
					</button>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="px-4 py-2 sm:px-6 sm:py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium text-sm sm:text-base"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
