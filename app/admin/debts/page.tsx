import { getAllDebts, getPaymentsByDebt } from "@/lib/debts/store";
import { CreditCard, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AddDebtForm from "./AddDebtForm";
import DebtsList from "./DebtsList";
import { getExpenseDebts, processOverdueExpensesToDebts } from "@/lib/expenses/carryover";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default async function DebtsPage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");

	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const planParam = searchParams.plan;
	const planCandidate = Array.isArray(planParam) ? planParam[0] : planParam;
	const requestedPlanId = typeof planCandidate === "string" ? planCandidate : "";

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	if (!requestedPlanId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/debts`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: requestedPlanId } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}/debts`);
	}

	const budgetPlanId = budgetPlan.id;

	// Ensure overdue/part-paid expenses are reflected as debts.
	await processOverdueExpensesToDebts(budgetPlanId);
	
	// Get regular debts and expense-derived debts separately
	const regularDebts = (await getAllDebts(budgetPlanId)).filter((d) => d.sourceType !== "expense");
	const expenseDebts = await getExpenseDebts(budgetPlanId);
	
	// Combine both types
	const allDebts = [...regularDebts, ...expenseDebts];
	const activeDebts = allDebts.filter((d) => d.currentBalance > 0);
	const activeRegularDebts = regularDebts.filter((d) => d.currentBalance > 0);
	const activeExpenseDebts = expenseDebts.filter((d) => d.currentBalance > 0);
	
	const totalDebt = allDebts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);
	const totalInitialDebt = allDebts.reduce((sum, debt) => sum + (debt.initialBalance || 0), 0);
	const totalPaidAmount = allDebts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0);
	const debtPayoffProgress = totalInitialDebt > 0 ? (totalPaidAmount / totalInitialDebt) * 100 : 0;

	// Create payments map for efficient lookup
	const paymentsEntries = await Promise.all(
		activeDebts.map(async (debt) => [debt.id, await getPaymentsByDebt(budgetPlanId, debt.id)] as const)
	);
	const paymentsMap = new Map(paymentsEntries);

	const typeLabels = {
		credit_card: "Credit Card",
		loan: "Loan",
		high_purchase: "High Purchase",
		other: "Other",
	} as const;

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
<div className="mb-6 sm:mb-8">
				<h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Debt Management</h1>
				<p className="text-xs sm:text-sm text-slate-400">Track credit cards, loans, and high purchase debts</p>
				</div>

				{/* Total Debt Overview */}
			<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-6 mb-6 sm:mb-8 hover:border-white/20 transition-all">
				<div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
					<div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500 to-red-700 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0">
						<CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-xs sm:text-sm text-slate-400 mb-0.5 sm:mb-1">Total Outstanding Debt</div>
						<div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white truncate">
								<Currency value={totalDebt} />
							</div>
						<div className="text-xs sm:text-sm text-slate-400 mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-2">
							<div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></div>
								{activeDebts.length} debt{activeDebts.length !== 1 ? "s" : ""} tracked
							</div>
						</div>
					</div>

					{/* Progress Tracker */}
					{totalInitialDebt > 0 && (
					<div className="mt-4 sm:mt-6">
						<div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
							<span className="text-slate-300">Debt Payoff Progress</span>
							<span className="font-semibold text-white text-xs sm:text-sm">
									<Currency value={totalPaidAmount} /> / <Currency value={totalInitialDebt} />
								</span>
							</div>
						<div className="w-full bg-white/10 rounded-full h-2 sm:h-3">
							<div
								className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 sm:h-3 rounded-full transition-all"
									style={{ width: `${Math.min(100, debtPayoffProgress)}%` }}
								/>
							</div>
							<div className="text-right text-xs text-slate-400 mt-1">
								{debtPayoffProgress.toFixed(1)}% paid off
							</div>
						</div>
					)}
				</div>

				{/* Add New Debt Form */}
				<AddDebtForm budgetPlanId={budgetPlanId} />

				{/* Debts List */}
				<div className="space-y-4 sm:space-y-6">
					{/* Unpaid Expenses Section */}
					{activeExpenseDebts.length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-3 sm:mb-4">
								<AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
								<h2 className="text-base sm:text-lg font-semibold text-white">Unpaid Expenses</h2>
								<span className="text-xs sm:text-sm text-slate-400">({activeExpenseDebts.length} item{activeExpenseDebts.length !== 1 ? 's' : ''})</span>
							</div>
							<p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">
								These expenses weren&apos;t fully paid and have been carried over as debts. Pay them to clear from your budget.
							</p>
							<DebtsList 
								debts={activeExpenseDebts}
								budgetPlanId={budgetPlanId}
								typeLabels={typeLabels}
								paymentsMap={paymentsMap}
								payDate={budgetPlan.payDate}
							/>
						</div>
					)}

					{/* Regular Debts Section */}
					{activeRegularDebts.length > 0 && (
						<div>
							<h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Regular Debts</h2>
							<DebtsList 
								debts={activeRegularDebts}
								budgetPlanId={budgetPlanId}
								typeLabels={typeLabels}
								paymentsMap={paymentsMap}
								payDate={budgetPlan.payDate}
							/>
						</div>
					)}

					{activeDebts.length === 0 && (
						<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 text-center border border-white/10">
							<div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🎉</div>
							<h3 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">No Debts!</h3>
							<p className="text-sm text-slate-400">You have no tracked debts at the moment.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
