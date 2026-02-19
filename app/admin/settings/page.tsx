import { getSettings } from "@/lib/settings/store";
import { getBudgetMonthSummary, isMonthKey } from "@/lib/budget/zero-based";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { redirect } from "next/navigation";
import SettingsContent from "@/components/Admin/Settings/SettingsContent";
import { createBudgetPlanAction } from "@/app/budgets/new/actions";

function prismaDebtHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.Debt?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

const DEBT_HAS_CREDIT_LIMIT = prismaDebtHasField("creditLimit");
const DEBT_HAS_DUE_DAY = prismaDebtHasField("dueDay");
const DEBT_HAS_DEFAULT_PAYMENT_SOURCE = prismaDebtHasField("defaultPaymentSource");
const DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID = prismaDebtHasField("defaultPaymentCardDebtId");

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const planParam = searchParams.plan;
	const planCandidate = Array.isArray(planParam) ? planParam[0] : planParam;
	let budgetPlanId = typeof planCandidate === "string" ? planCandidate : "";
	budgetPlanId = budgetPlanId.trim();

	if (!budgetPlanId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallback.id)}/settings`);
	}

	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, userId: true } });
	if (!plan || plan.userId !== userId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallback.id)}/settings`);
	}

	budgetPlanId = plan.id;
	
	// Get fresh user data from database
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, email: true },
	});
	
	// Get settings from database for this budget plan
	const settings = await getSettings(budgetPlanId);

	// Card settings (edit cards from Settings, kept in sync with Debts)
	// Avoid enum filtering (e.g. store_card) to stay resilient to stale Prisma Clients in dev.
	const debtsRaw = await prisma.debt.findMany({
		where: {
			budgetPlanId,
			sourceType: null,
		},
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
		orderBy: [{ createdAt: "asc" }],
	});
	const cardDebts = debtsRaw
		.filter((d) => d.type === "credit_card" || (d.type as any) === "store_card")
		.map((d) => ({
			id: d.id,
			name: d.name,
			type: d.type as any,
			creditLimit:
				(d as any).creditLimit == null
					? undefined
					: Number(((d as any).creditLimit as any)?.toString?.() ?? (d as any).creditLimit),
			dueDay: (d as any).dueDay ?? undefined,
			initialBalance: Number((d.initialBalance as any)?.toString?.() ?? d.initialBalance ?? 0),
			currentBalance: Number((d.currentBalance as any)?.toString?.() ?? d.currentBalance ?? 0),
			amount: Number((d.amount as any)?.toString?.() ?? d.amount ?? 0),
			paid: Boolean(d.paid),
			paidAmount: Number((d.paidAmount as any)?.toString?.() ?? d.paidAmount ?? 0),
			monthlyMinimum:
				d.monthlyMinimum == null
					? undefined
					: Number((d.monthlyMinimum as any)?.toString?.() ?? d.monthlyMinimum),
			interestRate:
				d.interestRate == null
					? undefined
					: Number((d.interestRate as any)?.toString?.() ?? d.interestRate),
			installmentMonths: d.installmentMonths ?? undefined,
			createdAt: d.createdAt.toISOString(),
			defaultPaymentSource: (d as any).defaultPaymentSource ?? undefined,
			defaultPaymentCardDebtId: (d as any).defaultPaymentCardDebtId ?? undefined,
			sourceType: (d as any).sourceType ?? undefined,
			sourceExpenseId: (d as any).sourceExpenseId ?? undefined,
			sourceMonthKey: (d as any).sourceMonthKey ?? undefined,
			sourceCategoryName: (d as any).sourceCategoryName ?? undefined,
			sourceExpenseName: (d as any).sourceExpenseName ?? undefined,
		}));
	
	// Get all budget plans for this user
	const allPlans = await prisma.budgetPlan.findMany({
		where: { userId },
		select: { id: true, name: true, kind: true },
		orderBy: { createdAt: 'asc' },
	});
	
	const monthParam = searchParams.month;
	const monthCandidate = Array.isArray(monthParam) ? monthParam[0] : monthParam;
	const selectedMonth: MonthKey =
		typeof monthCandidate === "string" && isMonthKey(monthCandidate) ? (monthCandidate as MonthKey) : "JANUARY";
	const monthSummary = settings.budgetStrategy && budgetPlanId ? await getBudgetMonthSummary(budgetPlanId, selectedMonth) : null;
	const fiftyThirtyTwenty =
		settings.budgetStrategy === "fiftyThirtyTwenty" && monthSummary
			? {
				needsTarget: monthSummary.incomeTotal * 0.5,
				wantsTarget: monthSummary.incomeTotal * 0.3,
				savingsDebtTarget: monthSummary.incomeTotal * 0.2,
				needsActual: monthSummary.expenseTotal,
				wantsActual: monthSummary.plannedAllowance,
				savingsDebtActual:
					monthSummary.plannedSavings +
					monthSummary.plannedEmergency +
					monthSummary.plannedInvestments +
					monthSummary.debtPaymentsTotal,
			}
			: null;

	return (
		<SettingsContent
			budgetPlanId={budgetPlanId}
			settings={settings}
			cardDebts={cardDebts}
			sessionUser={{
				id: userId,
				name: user?.name || sessionUser.name || '',
				email: user?.email || '',
			}}
			monthSummary={monthSummary}
			fiftyThirtyTwenty={fiftyThirtyTwenty}
			selectedMonth={selectedMonth}
			allPlans={allPlans}
			createBudgetPlanAction={createBudgetPlanAction}
		/>
	);
}
