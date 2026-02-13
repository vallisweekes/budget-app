import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAllExpenses } from "@/lib/expenses/store";
import ExpensesPageClient from "./ExpensesPageClient";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId, listBudgetPlansForUser } from "@/lib/budgetPlans";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { isMonthKey } from "@/lib/budget/zero-based";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
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
	redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/expenses`);
  }

  const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId } });
  if (!plan || plan.userId !== userId) {
  const fallback = await getDefaultBudgetPlanForUser({ userId, username });
  if (!fallback) redirect("/budgets/new");
  redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/expenses`);
  }

  budgetPlanId = plan.id;

  const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const parsedYear = rawYear == null ? NaN : Number(rawYear);
  const selectedYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  const rawMonth = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const monthCandidate = typeof rawMonth === "string" ? rawMonth : "";
  const selectedMonth: MonthKey = isMonthKey(monthCandidate)
    ? (monthCandidate as MonthKey)
    : (MONTHS[0] as MonthKey);

  // Normalize URL so month/year are always present.
  if (!rawYear || !rawMonth) {
    redirect(
    `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/expenses?year=${encodeURIComponent(
      String(selectedYear)
    )}&month=${encodeURIComponent(selectedMonth)}`
    );
  }

  // Fetch all plans for this user
  const allPlans = await listBudgetPlansForUser({ userId, username });
  
  // Fetch expenses and categories for all plans
  const allPlansData = await Promise.all(
    allPlans.map(async (p) => {
      const expenses = await getAllExpenses(p.id, selectedYear);
      const categories = await prisma.category.findMany({
        where: { budgetPlanId: p.id },
      });
      return {
        plan: p,
        expenses,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon ?? undefined,
          color: c.color ?? undefined,
          featured: c.featured,
        })),
      };
    })
  );
	
  return (
    <ExpensesPageClient
      allPlansData={allPlansData}
      initialYear={selectedYear}
      initialMonth={selectedMonth}
    />
  );
}
