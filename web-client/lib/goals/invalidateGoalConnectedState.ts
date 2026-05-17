import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";

export async function invalidateGoalConnectedState(budgetPlanId: string): Promise<void> {
  await invalidateDashboardCache(budgetPlanId);
}