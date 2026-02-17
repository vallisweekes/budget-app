import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAllGoals } from "@/lib/goals/store";
import GoalCard from "@/app/admin/goals/GoalCard";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import AddGoalModal from "@/app/admin/goals/AddGoalModal";

export const dynamic = "force-dynamic";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const username = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUser || !username) {
    redirect("/");
  }
  const userId = await resolveUserId({ userId: sessionUser.id, username });

  const sp = await searchParams;
  const rawPlan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  let budgetPlanId = String(rawPlan ?? "").trim();

  if (!budgetPlanId) {
    const fallback = await getDefaultBudgetPlanForUser({ userId, username });
    if (!fallback) redirect("/budgets/new");
	redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/goals`);
  }

  const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId } });
  if (!plan || plan.userId !== userId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/goals`);
  }

  budgetPlanId = plan.id;

  const goals = await getAllGoals(budgetPlanId);
  const yearlyGoals = goals.filter(g => g.type === "yearly");
  const longTermGoals = goals.filter(g => g.type === "long-term");
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen pb-20 app-theme-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Financial Goals</h1>
          <p className="text-xs sm:text-sm text-slate-400">Track your yearly and 10-year financial targets</p>
        </div>

        <div className="mb-6 sm:mb-8">
          <AddGoalModal budgetPlanId={budgetPlanId} />
        </div>

        {yearlyGoals.length === 0 && longTermGoals.length === 0 ? (
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/10 text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">No goals yet</h2>
            <p className="text-xs sm:text-sm text-slate-400">Add your first goal using the panel above.</p>
          </div>
        ) : (
          <>
            {/* This Year's Goals */}
            {yearlyGoals.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{currentYear} Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {yearlyGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} budgetPlanId={budgetPlanId} />
                  ))}
                </div>
              </div>
            )}

            {/* 10-Year Goals */}
            {longTermGoals.length > 0 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                  10-Year Goals ({currentYear}-{currentYear + 9})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {longTermGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} budgetPlanId={budgetPlanId} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}