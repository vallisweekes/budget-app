import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAllExpenses } from "@/lib/expenses/store";
import { getCategories } from "@/lib/categories/store";
import ExpensesPageClient from "./ExpensesPageClient";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";

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
    redirect(`/admin/expenses?plan=${encodeURIComponent(fallback.id)}`);
  }

  const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId } });
  if (!plan || plan.userId !== userId) {
    redirect("/dashboard");
  }

  budgetPlanId = plan.id;

  const expenses = await getAllExpenses(budgetPlanId);
  const categories = await getCategories();
	
  return <ExpensesPageClient budgetPlanId={budgetPlanId} expenses={expenses} categories={categories} />;
}
