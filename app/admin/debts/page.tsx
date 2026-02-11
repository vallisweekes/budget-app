import { getAllDebts, getTotalDebtBalance, getPaymentsByDebt } from "../../../lib/debts/store";
import { createDebt, deleteDebtAction, makePaymentFromForm } from "../../../lib/debts/actions";
import { CreditCard, TrendingDown, ShoppingBag, Trash2 } from "lucide-react";

function Currency({ value }: { value: number }) {
	return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function DebtsPage() {
	const debts = getAllDebts();
	const totalDebt = getTotalDebtBalance();

	const typeIcons = {
		credit_card: CreditCard,
		loan: TrendingDown,
		high_purchase: ShoppingBag,
	} as const;

	const typeLabels = {
		credit_card: "Credit Card",
		loan: "Loan",
		high_purchase: "High Purchase",
	} as const;

	return (
		<div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">Debt Management</h1>
					<p className="text-slate-400">Track credit cards, loans, and high purchase debts</p>
				</div>

				{/* Total Debt Overview */}
				<div className="bg-gradient-to-br from-red-400 to-red-600 rounded-3xl p-6 text-white shadow-lg mb-8">
					<div className="text-sm opacity-90 mb-2">Total Outstanding Debt</div>
					<div className="text-4xl font-bold">
						<Currency value={totalDebt} />
					</div>
					<div className="text-sm opacity-75 mt-2">
						{debts.length} debt{debts.length !== 1 ? "s" : ""} tracked
					</div>
				</div>

				{/* Add New Debt Form */}
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 mb-8">
					<h2 className="text-xl font-semibold mb-4 text-white">Add New Debt</h2>
					<form action={createDebt} className="space-y-4">
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
								<select
									name="type"
									required
									className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								>
									<option value="credit_card">Credit Card</option>
									<option value="loan">Loan</option>
									<option value="high_purchase">High Purchase</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Initial Balance</label>
								<input
									type="number"
									name="initialBalance"
									step="0.01"
									placeholder="450.00"
									required
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
						<button
							type="submit"
							className="w-full md:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg hover:shadow-xl"
						>
							Add Debt
						</button>
					</form>
				</div>

				{/* Debts List */}
				<div className="space-y-4">
					<h2 className="text-xl font-semibold text-white">Current Debts</h2>
					{debts.length === 0 ? (
						<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/10">
							<div className="text-6xl mb-4">🎉</div>
							<h3 className="text-xl font-semibold text-white mb-2">No Debts!</h3>
							<p className="text-slate-400">You have no tracked debts at the moment.</p>
						</div>
					) : (
						debts.map((debt) => {
							const Icon = typeIcons[debt.type as keyof typeof typeIcons];
							const percentPaid = debt.initialBalance > 0
								? ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100
								: 0;
							const payments = getPaymentsByDebt(debt.id);

							return (
								<div
									key={debt.id}
									className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all"
								>
									<div className="flex items-start justify-between mb-4">
										<div className="flex items-center gap-4">
											<div className="p-3 bg-red-500/10 backdrop-blur-sm rounded-full">
												<Icon className="w-6 h-6 text-red-400" />
											</div>
											<div>
												<h3 className="text-lg font-bold text-white">{debt.name}</h3>
												<p className="text-sm text-slate-400">{typeLabels[debt.type as keyof typeof typeLabels]}</p>
											</div>
										</div>
										<form action={deleteDebtAction.bind(null, debt.id)} className="inline">
											<button
												type="submit"
												className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
												title="Delete debt"
											>
												<Trash2 className="w-5 h-5" />
											</button>
										</form>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
										<div>
											<div className="text-xs text-slate-400 mb-1">Current Balance</div>
											<div className="text-xl font-bold text-red-400">
												<Currency value={debt.currentBalance} />
											</div>
										</div>
										<div>
											<div className="text-xs text-slate-400 mb-1">Initial Balance</div>
											<div className="text-lg font-semibold text-slate-300">
												<Currency value={debt.initialBalance} />
											</div>
										</div>
										{debt.monthlyMinimum && (
											<div>
												<div className="text-xs text-slate-400 mb-1">Monthly Minimum</div>
												<div className="text-lg font-semibold text-slate-300">
													<Currency value={debt.monthlyMinimum} />
												</div>
											</div>
										)}
										{debt.interestRate && (
											<div>
												<div className="text-xs text-slate-400 mb-1">Interest Rate</div>
												<div className="text-lg font-semibold text-slate-300">
													{debt.interestRate}%
												</div>
											</div>
										)}
									</div>

									{/* Progress Bar */}
									<div className="mb-4">
										<div className="flex justify-between text-xs text-slate-400 mb-1">
											<span>Progress</span>
											<span>{percentPaid.toFixed(1)}% paid</span>
										</div>
										<div className="w-full bg-white/10 rounded-full h-2">
											<div
												className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all"
												style={{ width: `${Math.min(100, percentPaid)}%` }}
											/>
										</div>
									</div>

									{/* Make Payment Form */}
									<form action={makePaymentFromForm} className="flex gap-2">
										<input type="hidden" name="debtId" value={debt.id} />
										{/* TODO: Wire this to the selected month/year once available */}
										<input type="hidden" name="month" value="2026-02" />
										<label className="flex-1">
											<span className="block text-xs font-medium text-slate-300 mb-1">Payment Amount</span>
											<input
												type="number"
												name="amount"
												step="0.01"
												placeholder="Payment amount"
												required
												aria-label="Payment amount"
												className="w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
											/>
										</label>
										<button
											type="submit"
											className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-lg hover:shadow-xl cursor-pointer"
										>
											Make Payment
										</button>
									</form>

									{payments.length > 0 && (
										<div className="mt-4 pt-4 border-t border-white/10">
											<div className="text-xs text-slate-400 mb-2">Recent Payments</div>
											<div className="space-y-1">
												{payments.slice(-3).reverse().map((payment) => (
													<div key={payment.id} className="flex justify-between text-sm">
														<span className="text-slate-400">
															{new Date(payment.date).toLocaleDateString()}
														</span>
														<span className="font-semibold text-emerald-400">
															-<Currency value={payment.amount} />
														</span>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
