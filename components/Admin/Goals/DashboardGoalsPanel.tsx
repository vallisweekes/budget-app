import type { Goal } from "@/lib/goals/store";

export default function DashboardGoalsPanel({
  selectedGoals,
  selectedCount,
  usingDefaults,
  hasDefaults,
  isPending,
  onReset,
  onToggleGoal,
}: {
  selectedGoals: Goal[];
  selectedCount: number;
  usingDefaults: boolean;
  hasDefaults: boolean;
  isPending: boolean;
  onReset: () => void;
  onToggleGoal: (goal: Goal) => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base sm:text-lg font-semibold text-white">Dashboard goals</div>
          <div className="mt-0.5 text-[11px] sm:text-xs text-slate-300">
            Pick up to 2 goals to show on your dashboard home page.
          </div>
          {usingDefaults && hasDefaults ? (
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
              onClick={onReset}
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
              onClick={() => onToggleGoal(g)}
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
  );
}
