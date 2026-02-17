"use client";

import { useMemo, useState, useTransition } from "react";
import GoalCard from "@/app/admin/goals/GoalCard";
import type { Goal } from "@/lib/goals/store";

type GoalsByYear = { year: number; goals: Goal[] };

function getHomepageEligibility(goal: Goal): { eligible: boolean; reason?: string } {
  void goal;
  return { eligible: true };
}

export default function GoalsPageClient({
  budgetPlanId,
  minYear,
  maxYear,
  outOfHorizonGoals,
  goalsByYear,
  initialHomepageGoalIds,
}: {
  budgetPlanId: string;
  minYear: number;
  maxYear: number;
  outOfHorizonGoals: Goal[];
  goalsByYear: GoalsByYear[];
  initialHomepageGoalIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [homepageGoalIds, setHomepageGoalIds] = useState<string[]>(() =>
    Array.isArray(initialHomepageGoalIds) ? initialHomepageGoalIds.slice(0, 2) : []
  );
  const [homepageError, setHomepageError] = useState<string | null>(null);

  const allGoals = useMemo(() => {
    const flattened: Goal[] = [];
    flattened.push(...outOfHorizonGoals);
    goalsByYear.forEach((g) => flattened.push(...g.goals));
    const byId = new Map<string, Goal>();
    flattened.forEach((goal) => {
      if (!byId.has(goal.id)) byId.set(goal.id, goal);
    });
    return Array.from(byId.values());
  }, [goalsByYear, outOfHorizonGoals]);

  const defaultSelectedIds = useMemo(() => {
		const eligible = allGoals.filter((g) => getHomepageEligibility(g).eligible);
    const emergency = eligible.find((g) => g.category === "emergency");
    const savings = eligible.find((g) => g.category === "savings");
    const defaults: string[] = [];
    if (emergency) defaults.push(emergency.id);
    if (savings && savings.id !== emergency?.id) defaults.push(savings.id);
    return defaults.slice(0, 2);
  }, [allGoals]);

  const effectiveSelectedIds = useMemo(() => {
    return homepageGoalIds.length > 0 ? homepageGoalIds.slice(0, 2) : defaultSelectedIds;
  }, [defaultSelectedIds, homepageGoalIds]);

  const selectedSet = useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);
  const selectedCount = effectiveSelectedIds.length;
  const usingDefaults = homepageGoalIds.length === 0;

  const selectedGoals = useMemo(() => {
    const byId = new Map<string, Goal>();
    allGoals.forEach((g) => byId.set(g.id, g));
    return effectiveSelectedIds.map((id) => byId.get(id)).filter((g): g is Goal => Boolean(g));
  }, [allGoals, effectiveSelectedIds]);

  const saveHomepageGoalIds = async (nextIds: string[]) => {
    const res = await fetch("/api/bff/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetPlanId, homepageGoalIds: nextIds.slice(0, 2) }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as any;
      throw new Error(typeof body?.error === "string" ? body.error : "Failed to save homepage goals");
    }
    const updated = (await res.json().catch(() => null)) as any;
    return Array.isArray(updated?.homepageGoalIds)
      ? updated.homepageGoalIds.filter((v: any) => typeof v === "string").slice(0, 2)
      : nextIds.slice(0, 2);
  };

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
      if (selectedCount >= 2) {
        setHomepageError("You can only show 2 goals on the dashboard.");
        return;
      }
      nextIds = [...effectiveSelectedIds, goal.id].slice(0, 2);
    }

    const prev = homepageGoalIds;
    setHomepageGoalIds(nextIds);

    startTransition(async () => {
      try {
        const saved = await saveHomepageGoalIds(nextIds);
        setHomepageGoalIds(saved);
      } catch (e) {
        setHomepageGoalIds(prev);
        setHomepageError(String((e as any)?.message ?? e));
      }
    });
  };

  const renderGrid = (goals: Goal[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {goals.map((goal) => {
        const selected = selectedSet.has(goal.id);
				const eligibility = getHomepageEligibility(goal);
				const eligible = eligibility.eligible;
        const disableBecauseMax = !selected && selectedCount >= 2;
        const disabled = isPending || !eligible || disableBecauseMax;

        let disabledReason: string | undefined;
				if (!eligible) disabledReason = eligibility.reason ?? "Not eligible";
        else if (disableBecauseMax) disabledReason = "Remove one of the selected goals first";
        else if (isPending) disabledReason = "Saving…";

        return (
          <GoalCard
            key={goal.id}
            goal={goal}
            budgetPlanId={budgetPlanId}
            minYear={minYear}
            maxYear={maxYear}
            homepageSelected={selected}
            homepageToggleDisabled={disabled}
            homepageToggleDisabledReason={disabledReason}
            onToggleHomepage={() => toggleHomepage(goal)}
          />
        );
      })}
    </div>
  );

  return (
    <>
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base sm:text-lg font-semibold text-white">Dashboard goals</div>
            <div className="mt-0.5 text-[11px] sm:text-xs text-slate-300">
              Pick up to 2 goals to show on your dashboard home page.
            </div>
            {usingDefaults && defaultSelectedIds.length > 0 ? (
              <div className="mt-1 text-[11px] sm:text-xs text-slate-400">
                Currently using defaults (Emergency + Savings). Click “Hide from dashboard” on a card to customize.
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs sm:text-sm text-slate-300">
              <span className="font-semibold text-white">{selectedCount}</span>/2 selected
            </div>
            {!usingDefaults ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setHomepageError(null);
                  const prev = homepageGoalIds;
                  setHomepageGoalIds([]);
                  startTransition(async () => {
                    try {
                      const saved = await saveHomepageGoalIds([]);
                      setHomepageGoalIds(saved);
                    } catch (e) {
                      setHomepageGoalIds(prev);
                      setHomepageError(String((e as any)?.message ?? e));
                    }
                  });
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] sm:text-xs font-semibold text-white/90 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Reset dashboard goals back to defaults"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedGoals.length > 0 ? (
            selectedGoals.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={isPending}
                onClick={() => toggleHomepage(g)}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] sm:text-xs font-semibold text-white/90 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Click to remove from dashboard"
              >
                <span className="truncate max-w-[220px]">{g.title}</span>
                <span className="text-white/60">×</span>
              </button>
            ))
          ) : (
            <div className="text-[11px] sm:text-xs text-slate-400">
              No dashboard goals selected yet. Click “Show on dashboard” on any goal card below.
            </div>
          )}
        </div>
      </div>

      {homepageError ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {homepageError}
        </div>
      ) : null}

      {outOfHorizonGoals.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 backdrop-blur-xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-amber-100">Some goals are outside your budget horizon</h2>
                <p className="text-xs sm:text-sm text-amber-200/80 mt-0.5">
                  Update their target year to be between {minYear} and {maxYear}.
                </p>
              </div>
              <div className="text-xs sm:text-sm text-amber-100 font-semibold">
                {outOfHorizonGoals.length} needing update
              </div>
            </div>
            <div className="mt-4">{renderGrid(outOfHorizonGoals)}</div>
          </div>
        </div>
      )}

      {goalsByYear.map(({ year, goals }) => {
        if (goals.length === 0) return null;
        return (
          <div key={year} className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{year} Goals</h2>
            {renderGrid(goals)}
          </div>
        );
      })}
    </>
  );
}
