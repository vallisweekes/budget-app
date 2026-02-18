import { useMemo, useState, useTransition } from "react";
import type { Goal } from "@/lib/goals/store";

const MAX_DASHBOARD_GOALS = 2;

function getHomepageEligibility(goal: Goal): { eligible: boolean; reason?: string } {
  void goal;
  return { eligible: true };
}

async function saveHomepageGoalIds({
  budgetPlanId,
  nextIds,
}: {
  budgetPlanId: string;
  nextIds: string[];
}): Promise<string[]> {
  const res = await fetch("/api/bff/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgetPlanId, homepageGoalIds: nextIds.slice(0, MAX_DASHBOARD_GOALS) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(typeof body?.error === "string" ? body.error : "Failed to save homepage goals");
  }
  const updated = (await res.json().catch(() => null)) as any;
  return Array.isArray(updated?.homepageGoalIds)
    ? updated.homepageGoalIds.filter((v: any) => typeof v === "string").slice(0, MAX_DASHBOARD_GOALS)
    : nextIds.slice(0, MAX_DASHBOARD_GOALS);
}

export function useDashboardGoals({
  budgetPlanId,
  allGoals,
  initialHomepageGoalIds,
}: {
  budgetPlanId: string;
  allGoals: Goal[];
  initialHomepageGoalIds: string[];
}) {
  const [isPending, startTransition] = useTransition();

  const [homepageGoalIds, setHomepageGoalIds] = useState<string[]>(() =>
    Array.isArray(initialHomepageGoalIds)
      ? initialHomepageGoalIds.slice(0, MAX_DASHBOARD_GOALS)
      : []
  );
  const [homepageError, setHomepageError] = useState<string | null>(null);

  const defaultSelectedIds = useMemo(() => {
    const eligible = allGoals.filter((g) => getHomepageEligibility(g).eligible);
    const emergency = eligible.find((g) => g.category === "emergency");
    const savings = eligible.find((g) => g.category === "savings");
    const defaults: string[] = [];
    if (emergency) defaults.push(emergency.id);
    if (savings && savings.id !== emergency?.id) defaults.push(savings.id);
    return defaults.slice(0, MAX_DASHBOARD_GOALS);
  }, [allGoals]);

  const effectiveSelectedIds = useMemo(() => {
    return homepageGoalIds.length > 0
      ? homepageGoalIds.slice(0, MAX_DASHBOARD_GOALS)
      : defaultSelectedIds;
  }, [defaultSelectedIds, homepageGoalIds]);

  const selectedSet = useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);
  const selectedCount = effectiveSelectedIds.length;
  const usingDefaults = homepageGoalIds.length === 0;

  const selectedGoals = useMemo(() => {
    const byId = new Map<string, Goal>();
    allGoals.forEach((g) => byId.set(g.id, g));
    return effectiveSelectedIds.map((id) => byId.get(id)).filter((g): g is Goal => Boolean(g));
  }, [allGoals, effectiveSelectedIds]);

  const toggleHomepage = (goal: Goal) => {
    setHomepageError(null);

    const eligibility = getHomepageEligibility(goal);
    if (!eligibility.eligible) {
      setHomepageError(eligibility.reason ?? "This goal can’t be shown on the dashboard.");
      return;
    }

    const wasSelected = selectedSet.has(goal.id);
    let nextIds: string[];

    if (wasSelected) {
      nextIds = effectiveSelectedIds.filter((id) => id !== goal.id);
    } else {
      if (selectedCount >= MAX_DASHBOARD_GOALS) {
        setHomepageError(`You can only show ${MAX_DASHBOARD_GOALS} goals on the dashboard.`);
        return;
      }
      nextIds = [...effectiveSelectedIds, goal.id].slice(0, MAX_DASHBOARD_GOALS);
    }

    const prev = homepageGoalIds;
    setHomepageGoalIds(nextIds);

    startTransition(async () => {
      try {
        const saved = await saveHomepageGoalIds({ budgetPlanId, nextIds });
        setHomepageGoalIds(saved);
      } catch (e) {
        setHomepageGoalIds(prev);
        setHomepageError(String((e as any)?.message ?? e));
      }
    });
  };

  const resetHomepage = () => {
    setHomepageError(null);
    const prev = homepageGoalIds;
    setHomepageGoalIds([]);
    startTransition(async () => {
      try {
        const saved = await saveHomepageGoalIds({ budgetPlanId, nextIds: [] });
        setHomepageGoalIds(saved);
      } catch (e) {
        setHomepageGoalIds(prev);
        setHomepageError(String((e as any)?.message ?? e));
      }
    });
  };

  const getToggleState = (goal: Goal) => {
    const selected = selectedSet.has(goal.id);
    const eligibility = getHomepageEligibility(goal);
    const eligible = eligibility.eligible;
    const disableBecauseMax = !selected && selectedCount >= MAX_DASHBOARD_GOALS;
    const disabled = isPending || !eligible || disableBecauseMax;

    let disabledReason: string | undefined;
    if (!eligible) disabledReason = eligibility.reason ?? "Not eligible";
    else if (disableBecauseMax) disabledReason = "Remove one of the selected goals first";
    else if (isPending) disabledReason = "Saving…";

    return { selected, disabled, disabledReason };
  };

  return {
    isPending,
    homepageError,
    usingDefaults,
    selectedCount,
    selectedSet,
    defaultSelectedIds,
    selectedGoals,
    toggleHomepage,
    resetHomepage,
    getToggleState,
  };
}
