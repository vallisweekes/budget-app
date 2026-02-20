import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAllExpenses } from "@/lib/expenses/store";
import ExpensesPageClient from "./ExpensesPageClient";
import { prisma } from "@/lib/prisma";
import { getDefaultBudgetPlanForUser, resolveUserId, listBudgetPlansForUser } from "@/lib/budgetPlans";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import type { MonthKey } from "@/types";
import { currentMonthKey, normalizeMonthKey } from "@/lib/helpers/monthKey";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { MONTHS } from "@/lib/constants/time";
import { withPrismaRetry } from "@/lib/prismaRetry";

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

  const user = await withPrismaRetry(
		() => prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
		{ retries: 1, delayMs: 75 }
	);
  const userCreatedAt = user?.createdAt ?? new Date();
  const userStartYear = userCreatedAt.getUTCFullYear();
  const userStartMonthIndex = userCreatedAt.getUTCMonth(); // 0-11
  const sp = await searchParams;
  const rawPlan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  let budgetPlanId = String(rawPlan ?? "").trim();

  if (!budgetPlanId) {
    const fallback = await getDefaultBudgetPlanForUser({ userId, username });
    if (!fallback) redirect("/budgets/new");
	redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/expenses`);
  }

  const plan = await withPrismaRetry(
		() => prisma.budgetPlan.findUnique({ where: { id: budgetPlanId } }),
		{ retries: 1, delayMs: 75 }
	);
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
	const selectedMonth: MonthKey = normalizeMonthKey(monthCandidate) ?? currentMonthKey();
  const currentYear = new Date().getFullYear();

  const rawOpenCategoryId = Array.isArray(sp.openCategoryId)
    ? sp.openCategoryId[0]
    : (sp.openCategoryId ?? (Array.isArray(sp.categoryId) ? sp.categoryId[0] : sp.categoryId));
  const openCategoryId = typeof rawOpenCategoryId === "string" && rawOpenCategoryId.trim() ? rawOpenCategoryId.trim() : null;

  if (openCategoryId) {
    redirect(
      `/user=${encodeURIComponent(username)}/${encodeURIComponent(
        budgetPlanId
      )}/page=expense-category/${encodeURIComponent(openCategoryId)}?year=${encodeURIComponent(
        String(selectedYear)
      )}&month=${encodeURIComponent(selectedMonth)}`
    );
  }

  if (selectedYear < userStartYear) {
    const minMonth = (MONTHS as MonthKey[])[Math.min(Math.max(userStartMonthIndex, 0), 11)] ?? selectedMonth;
    redirect(
      `/user=${encodeURIComponent(username)}/${encodeURIComponent(
        budgetPlanId
      )}/page=expenses?year=${encodeURIComponent(String(userStartYear))}&month=${encodeURIComponent(minMonth)}`
    );
  }

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
  const planIds = allPlans.map((p) => p.id);
  const incomeCoverageSelectedYear = await getIncomeMonthsCoverageByPlan({ planIds, year: selectedYear });
  const incomeCoverageCurrentYear = selectedYear === currentYear
    ? incomeCoverageSelectedYear
    : await getIncomeMonthsCoverageByPlan({ planIds, year: currentYear });
  const hasAnyIncome =
    Object.values(incomeCoverageSelectedYear).some((n) => (n ?? 0) > 0) ||
    Object.values(incomeCoverageCurrentYear).some((n) => (n ?? 0) > 0);
  
  // Fetch expenses and categories for all plans
  const allPlansData = await Promise.all(
    allPlans.map(async (p) => {
      type PlanWithHorizon = typeof p & { budgetHorizonYears?: number | null };
      const planHorizonYears = (p as PlanWithHorizon).budgetHorizonYears ?? 10;
      const expenses = await getAllExpenses(p.id, selectedYear);
      const currentYearExpenses = currentYear === selectedYear ? expenses : await getAllExpenses(p.id, currentYear);
	  await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: p.id });
      const categories = await prisma.category.findMany({
        where: { budgetPlanId: p.id },
      });
		const creditCards = await prisma.debt.findMany({
			where: { budgetPlanId: p.id, type: { in: ["credit_card", "store_card"] } },
			select: { id: true, name: true },
			orderBy: { createdAt: "asc" },
		});
		const debts = await prisma.debt.findMany({
			where: {
				budgetPlanId: p.id,
				sourceType: null,
			},
			select: { id: true, name: true, type: true },
			orderBy: { createdAt: "asc" },
		});
      return {
        plan: {
          id: p.id,
          name: p.name,
          kind: p.kind,
          payDate: p.payDate,
        budgetHorizonYears: planHorizonYears,
        },
        expenses,
        currentYearExpenses,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon ?? undefined,
          color: c.color ?? undefined,
          featured: c.featured,
        })),
		creditCards,
		debts,
      };
    })
  );

  // Focused category views are handled by /page=expense-category/<id>.

  const selectedMonthHasAnyExpenses = allPlansData.some((d) => {
    const list = d.expenses?.[selectedMonth] ?? [];
    return Array.isArray(list) && list.length > 0;
  });

  const selectedMonthIndex = (MONTHS as MonthKey[]).indexOf(selectedMonth);
  const isBeforeUserStartMonth =
    selectedYear === userStartYear && selectedMonthIndex >= 0 && selectedMonthIndex < userStartMonthIndex;

  // New users should not browse months before their signup month.
  // If there is existing expense data in that month, keep it accessible.
  if (isBeforeUserStartMonth && !selectedMonthHasAnyExpenses) {
    const minMonth = (MONTHS as MonthKey[])[Math.min(Math.max(userStartMonthIndex, 0), 11)] ?? selectedMonth;
    redirect(
      `/user=${encodeURIComponent(username)}/${encodeURIComponent(
        budgetPlanId
      )}/page=expenses?year=${encodeURIComponent(String(selectedYear))}&month=${encodeURIComponent(minMonth)}`
    );
  }
	
  return (
    <ExpensesPageClient
      allPlansData={allPlansData}
      initialYear={selectedYear}
      initialMonth={selectedMonth}
	  initialOpenCategoryId={null}
		hasAnyIncome={hasAnyIncome}
    userStartYear={userStartYear}
    userStartMonthIndex={userStartMonthIndex}
    />
  );
}
