import { getAllGoals } from "@/lib/goals/store";
import { createGoal } from "@/lib/goals/actions";
import GoalCard from "@/app/admin/goals/GoalCard";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  const goals = getAllGoals();
  const yearlyGoals = goals.filter(g => g.type === "yearly");
  const longTermGoals = goals.filter(g => g.type === "long-term");

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Financial Goals</h1>
          <p className="text-slate-400">Track your yearly and 10-year financial targets</p>
        </div>

        {/* Add New Goal (collapsed by default) */}
        <details className="group bg-slate-800/40 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-6 mb-8">
          <summary className="list-none cursor-pointer [&_summary::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Add New Goal</h2>
                <p className="text-slate-400 text-sm mt-1">Only show fields when you need them</p>
              </div>
              <div className="shrink-0 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-all">
                <span className="group-open:hidden">Add goal</span>
                <span className="hidden group-open:inline">Close</span>
              </div>
            </div>
          </summary>

          <div className="pt-6 mt-6 border-t border-white/10">
            <form action={createGoal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Goal Title</span>
                  <input
                    name="title"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    placeholder="e.g., Pay Back Debts"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Goal Type</span>
                  <select
                    name="type"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                  >
                      <option value="yearly">{"This Year's Goal"}</option>
                    <option value="long-term">10-Year Goal</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Category</span>
                  <select
                    name="category"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="debt">Debt</option>
                    <option value="savings">Savings</option>
                    <option value="emergency">Emergency Fund</option>
                    <option value="investment">Investment</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Target Amount (£)</span>
                  <input
                    name="targetAmount"
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    placeholder="Optional"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Current Amount (£)</span>
                  <input
                    name="currentAmount"
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    placeholder="Optional"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Target Year</span>
                  <input
                    name="targetYear"
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    placeholder="e.g., 2035"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-300 mb-1 block">Description</span>
                  <textarea
                    name="description"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    rows={2}
                    placeholder="Optional description"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Add Goal
              </button>
            </form>
          </div>
        </details>

        {/* This Year's Goals */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">2026 Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {yearlyGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
              />
            ))}
          </div>
        </div>

        {/* 10-Year Goals */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">10-Year Goals (2026-2035)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {longTermGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}