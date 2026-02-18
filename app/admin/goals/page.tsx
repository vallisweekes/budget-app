import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAllGoals } from "@/lib/goals/store";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { getSettings } from "@/lib/settings/store";
import AddGoalModal from "@/components/Admin/Goals/AddGoalModal";
import GoalsPageClient from "@/components/Admin/Goals/GoalsPageClient";
import { getGoalsBudgetInsights } from "@/lib/helpers/goalsBudgetInsights";

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
  const currentYear = new Date().getFullYear();
  const settings = await getSettings(budgetPlanId);
  const initialHomepageGoalIds = Array.isArray(settings.homepageGoalIds)
    ? settings.homepageGoalIds.filter((v): v is string => typeof v === "string").slice(0, 2)
    : [];
  const horizonYearsRaw = Number(settings.budgetHorizonYears ?? 10);
  const horizonYears = Number.isFinite(horizonYearsRaw) && horizonYearsRaw > 0 ? Math.floor(horizonYearsRaw) : 10;
  const minYear = currentYear;
  const maxYear = currentYear + horizonYears - 1;
  const plannedYears = Array.from({ length: horizonYears }, (_, i) => currentYear + i);

  const outOfHorizonGoals = goals.filter(
    (g) => g.targetYear !== undefined && (g.targetYear < minYear || g.targetYear > maxYear)
  );
  const inHorizonGoals = goals.filter(
    (g) => g.targetYear === undefined || (g.targetYear >= minYear && g.targetYear <= maxYear)
  );

  const goalsByYear = plannedYears.map((year) => {
    const forYear = inHorizonGoals.filter((g) => (g.targetYear ?? currentYear) === year);
    return { year, goals: forYear };
  });

  const budgetInsights = await getGoalsBudgetInsights({ budgetPlanId, monthsBack: 3 });

  return (
    <div className="min-h-screen pb-20 app-theme-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Financial Goals</h1>
          <p className="text-xs sm:text-sm text-slate-400">Track your targets across your budget horizon</p>
        </div>

        <div className="mb-6 sm:mb-8">
          <AddGoalModal
            budgetPlanId={budgetPlanId}
            minYear={minYear}
            maxYear={maxYear}
            defaultYear={currentYear}
            defaultBalances={{
              savings: settings.savingsBalance,
              emergency: settings.emergencyBalance,
            }}
          />
        </div>

        {goals.length === 0 ? (
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/10 text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">No goals yet</h2>
            <p className="text-xs sm:text-sm text-slate-400">Add your first goal using the panel above.</p>
          </div>
        ) : (
          <GoalsPageClient
            budgetPlanId={budgetPlanId}
            minYear={minYear}
            maxYear={maxYear}
            outOfHorizonGoals={outOfHorizonGoals}
            goalsByYear={goalsByYear}
            initialHomepageGoalIds={initialHomepageGoalIds}
				budgetInsights={budgetInsights}
          />
        )}
      </div>
    </div>
  );
}