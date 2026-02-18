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
