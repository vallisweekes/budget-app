import { listBudgetPlansForUser, resolveUserId } from "@/lib/budgetPlans";
import type { Session } from "next-auth";
import { getDashboardPlanDataForActivePayPeriod, type DashboardPlanData } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { resolveBudgetPlanPayPeriodContext } from "@/lib/api/payPeriodContext";

async function loadActivePayPeriodDashboardPlanData(planId: string, now: Date): Promise<DashboardPlanData> {
	const payPeriodContext = await resolveBudgetPlanPayPeriodContext({
		budgetPlanId: planId,
		now,
	});

	return getDashboardPlanDataForActivePayPeriod(planId, {
		now,
		payDate: payPeriodContext.payDate,
		payFrequency: payPeriodContext.payFrequency,
		payAnchorDate: payPeriodContext.payAnchorDate,
		planCreatedAt: payPeriodContext.effectiveStartAt,
		ensureDefaultCategories: false,
	});
}

export async function getAllPlansDashboardData({
	budgetPlanId,
	currentPlanData,
	now,
	userId,
	session,
	username,
}: {
	budgetPlanId: string;
	currentPlanData?: DashboardPlanData;
	now: Date;
	userId?: string;
	session: Session | null;
	username: string | null | undefined;
}): Promise<Record<string, DashboardPlanData>> {
	const directUserId = typeof userId === "string" ? userId.trim() : "";
	if (directUserId) {
		try {
			const plans = await listBudgetPlansForUser({ userId: directUserId });
			const planDataPairs = await Promise.all(
				plans.map(async (plan) => {
					if (plan.id === budgetPlanId && currentPlanData) return [plan.id, currentPlanData] as const;
					return [
						plan.id,
						await loadActivePayPeriodDashboardPlanData(plan.id, now),
					] as const;
				})
			);
			return Object.fromEntries(planDataPairs);
		} catch {
			return { [budgetPlanId]: currentPlanData ?? (await loadActivePayPeriodDashboardPlanData(budgetPlanId, now)) };
		}
	}

	const sessionUser = session?.user;
	if (!sessionUser || !username) {
		return { [budgetPlanId]: currentPlanData ?? (await loadActivePayPeriodDashboardPlanData(budgetPlanId, now)) };
	}

	try {
		const userId = await resolveUserId({ userId: sessionUser.id, username });
		const plans = await listBudgetPlansForUser({ userId, username });
		const planDataPairs = await Promise.all(
			plans.map(async (plan) => {
				if (plan.id === budgetPlanId && currentPlanData) return [plan.id, currentPlanData] as const;
				return [plan.id, await loadActivePayPeriodDashboardPlanData(plan.id, now)] as const;
			})
		);
		return Object.fromEntries(planDataPairs);
	} catch {
		return { [budgetPlanId]: currentPlanData ?? (await loadActivePayPeriodDashboardPlanData(budgetPlanId, now)) };
	}
}
