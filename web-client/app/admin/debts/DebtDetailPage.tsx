import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroCanvasLayout } from "@/components/Shared";
import DebtCard from "@/components/Admin/Debts/DebtCard";
import { prisma } from "@/lib/prisma";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { getPaymentsByDebt } from "@/lib/debts/store";

export default async function DebtDetailPage(props: {
	username: string;
	budgetPlanId: string;
	debtId: string;
}) {
	const { username, budgetPlanId, debtId } = props;

	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, payDate: true } });
	if (!plan) return notFound();

	const debtSummary = await getDebtSummaryForPlan(budgetPlanId, { includeExpenseDebts: true, ensureSynced: true });
	const debt = debtSummary.allDebts.find((d) => d.id === debtId);
	if (!debt) return notFound();

	const payments = await getPaymentsByDebt(budgetPlanId, debtId);

	const typeLabels = {
		credit_card: "Credit Card",
		store_card: "Store Card",
		loan: "Loan",
		mortgage: "Mortgage",
		hire_purchase: "Hire Purchase",
		other: "Other",
	} as const;

	const backHref = `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/page=debts`;

	return (
		<HeroCanvasLayout
			hero={
				<div className="space-y-2">
					<div>
						<Link
							href={backHref}
							className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
						>
							<span aria-hidden>←</span>
							Back to Debts
						</Link>
					</div>
					<h1 className="text-2xl sm:text-3xl font-bold text-white">{debt.name}</h1>
					<p className="text-xs sm:text-sm text-slate-400">Debt details</p>
				</div>
			}
		>
			<DebtCard
				debt={debt}
				creditCards={debtSummary.creditCards}
				budgetPlanId={budgetPlanId}
				typeLabels={typeLabels}
				payments={payments}
				payDate={plan.payDate}
				defaultExpanded
			/>
		</HeroCanvasLayout>
	);
}
