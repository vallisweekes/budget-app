"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SelectDropdown } from "@/components/Shared";
import { createDebt } from "@/lib/debts/actions";
import { formatCurrency } from "@/lib/helpers/money";

interface AddDebtFormProps {
	budgetPlanId: string;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function AddDebtForm({ budgetPlanId }: AddDebtFormProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [initialBalance, setInitialBalance] = useState("");
	const [installmentMonths, setInstallmentMonths] = useState("");

	const handleSubmit = async (formData: FormData) => {
		await createDebt(formData);
		setIsOpen(false);
		setInitialBalance("");
		setInstallmentMonths("");
	};

	if (!isOpen) {
		return (
			<button
				onClick={() => setIsOpen(true)}
				className="w-full md:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl flex items-center gap-2 justify-center mb-8"
			>
				<Plus className="w-5 h-5" />
				Add New Debt
			</button>
		);
	}

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 mb-8">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl font-semibold text-white">Add New Debt</h2>
				<button
					onClick={() => setIsOpen(false)}
					className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
					aria-label="Close"
				>
					<X className="w-5 h-5 text-slate-400" />
				</button>
			</div>
			<form action={handleSubmit} className="space-y-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
						<input
							type="text"
							name="name"
							placeholder="e.g., VANQUIS CARD"
							required
							className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
						<SelectDropdown
							name="type"
							required
							defaultValue="credit_card"
							options={[
								{ value: "credit_card", label: "Credit Card" },
								{ value: "loan", label: "Loan" },
								{ value: "high_purchase", label: "High Purchase" },
							]}
							buttonClassName="rounded-lg px-4 py-2 focus:ring-purple-500"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Initial Balance</label>
						<input
							type="number"
							name="initialBalance"
							step="0.01"
							placeholder="450.00"
							required
							value={initialBalance}
							onChange={(e) => setInitialBalance(e.target.value)}
							className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Monthly Minimum (Optional)</label>
						<input
							type="number"
							name="monthlyMinimum"
							step="0.01"
							placeholder="25.00"
							className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Interest Rate % (Optional)</label>
						<input
							type="number"
							name="interestRate"
							step="0.01"
							placeholder="19.9"
							className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-300 mb-2">Installment Plan (Optional)</label>
					<div className="flex flex-wrap gap-2 mb-3">
						{[0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36].map((months) => (
							<button
								key={months}
								type="button"
								onClick={() => setInstallmentMonths(months === 0 ? "" : String(months))}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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

				<div className="flex gap-3">
					<button
						type="submit"
						className="flex-1 md:flex-initial px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl"
					>
						Add Debt
					</button>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
