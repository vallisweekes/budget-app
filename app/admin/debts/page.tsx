import { getAllDebts, getPaymentsByDebt } from "@/lib/debts/store";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AddDebtForm from "./AddDebtForm";
import DebtsList from "./DebtsList";

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
	const debts = (await getAllDebts(budgetPlanId)).filter((d) => d.sourceType !== "expense");
	const activeDebts = debts.filter((d) => d.currentBalance > 0);
	const totalDebt = debts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);
	const totalInitialDebt = debts.reduce((sum, debt) => sum + (debt.initialBalance || 0), 0);
	const totalPaidAmount = debts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0);
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
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">Debt Management</h1>
					<p className="text-slate-400">Track credit cards, loans, and high purchase debts</p>
				</div>

				{/* Total Debt Overview */}
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 mb-8 hover:border-white/20 transition-all">
					<div className="flex items-center gap-4 mb-6">
						<div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center shadow-lg">
							<CreditCard className="w-8 h-8 text-white" />
						</div>
						<div className="flex-1">
							<div className="text-sm text-slate-400 mb-1">Total Outstanding Debt</div>
							<div className="text-4xl font-bold text-white">
								<Currency value={totalDebt} />
							</div>
							<div className="text-sm text-slate-400 mt-2 flex items-center gap-2">
								<div className="w-2 h-2 bg-red-500 rounded-full"></div>
								{activeDebts.length} debt{activeDebts.length !== 1 ? "s" : ""} tracked
							</div>
						</div>
					</div>

					{/* Progress Tracker */}
					{totalInitialDebt > 0 && (
						<div className="mt-6">
							<div className="flex justify-between text-sm mb-2">
								<span className="text-slate-300">Debt Payoff Progress</span>
								<span className="font-semibold text-white">
									<Currency value={totalPaidAmount} /> / <Currency value={totalInitialDebt} />
								</span>
							</div>
							<div className="w-full bg-white/10 rounded-full h-3">
								<div
									className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full transition-all"
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
				<div className="space-y-4">
					<h2 className="text-xl font-semibold text-white">Current Debts</h2>
					<DebtsList 
						debts={activeDebts}
						budgetPlanId={budgetPlanId}
						typeLabels={typeLabels}
						paymentsMap={paymentsMap}
						payDate={budgetPlan.payDate}
					/>
				</div>
			</div>
		</div>
	);
}
