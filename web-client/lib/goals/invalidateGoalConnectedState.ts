import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";
import { invalidateLegacyGoalSync } from "@/lib/income-sacrifice/legacyGoalSyncState";

export async function invalidateGoalConnectedState(budgetPlanId: string): Promise<void> {
  invalidateLegacyGoalSync(budgetPlanId);
  await invalidateDashboardCache(budgetPlanId);
}