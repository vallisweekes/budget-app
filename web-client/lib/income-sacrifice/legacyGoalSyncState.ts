const LEGACY_GOAL_SYNC_TTL_MS = 5 * 60 * 1000;

const lastLegacyGoalSyncAt = new Map<string, number>();
const inflightLegacyGoalSync = new Map<string, Promise<void>>();

export function invalidateLegacyGoalSync(budgetPlanId: string): void {
  lastLegacyGoalSyncAt.delete(budgetPlanId);
  inflightLegacyGoalSync.delete(budgetPlanId);
}

function hasFreshLegacyGoalSync(budgetPlanId: string): boolean {
  const lastSyncedAt = lastLegacyGoalSyncAt.get(budgetPlanId);
  return typeof lastSyncedAt === "number" && (Date.now() - lastSyncedAt) < LEGACY_GOAL_SYNC_TTL_MS;
}

export async function runLegacyGoalSync(
  budgetPlanId: string,
  run: () => Promise<boolean>,
): Promise<void> {
  if (hasFreshLegacyGoalSync(budgetPlanId)) {
    return;
  }

  const inflight = inflightLegacyGoalSync.get(budgetPlanId);
  if (inflight) {
    await inflight;
    return;
  }

  const promise = (async () => {
    const completed = await run();
    if (completed) {
      lastLegacyGoalSyncAt.set(budgetPlanId, Date.now());
    }
  })().finally(() => {
    inflightLegacyGoalSync.delete(budgetPlanId);
  });

  inflightLegacyGoalSync.set(budgetPlanId, promise);
  await promise;
}