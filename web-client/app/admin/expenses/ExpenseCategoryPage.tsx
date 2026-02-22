import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllExpenses } from "@/lib/expenses/store";
import { resolveUserId, getDefaultBudgetPlanForUser } from "@/lib/budgetPlans";
import type { MonthKey } from "@/types";
import { currentMonthKey, normalizeMonthKey } from "@/lib/helpers/monthKey";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import ExpenseCategoryPageClient from "@/app/admin/expenses/ExpenseCategoryPageClient";
import { withPrismaRetry } from "@/lib/prismaRetry";

export const dynamic = "force-dynamic";

export default async function ExpenseCategoryPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) redirect("/");

	const userId = await resolveUserId({ userId: sessionUser.id, username });
	const sp = await searchParams;

	const rawPlan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
	let budgetPlanId = String(rawPlan ?? "").trim();

	if (!budgetPlanId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username });
		if (!fallback) redirect("/budgets/new");
		budgetPlanId = fallback.id;
	}

	const plan = await withPrismaRetry(
		() => prisma.budgetPlan.findUnique({ where: { id: budgetPlanId } }),
		{ retries: 1, delayMs: 75 }
	);
	if (!plan || plan.userId !== userId) {
		const fallback = await getDefaultBudgetPlanForUser({ userId, username });
		if (!fallback) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(fallback.id)}/page=home`);
	}
	budgetPlanId = plan.id;

	const rawCategoryId = Array.isArray(sp.categoryId) ? sp.categoryId[0] : sp.categoryId;
	const categoryId = typeof rawCategoryId === "string" ? rawCategoryId.trim() : "";
	if (!categoryId) return notFound();

	const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
	const parsedYear = rawYear == null ? NaN : Number(rawYear);
	const selectedYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

	const rawMonth = Array.isArray(sp.month) ? sp.month[0] : sp.month;
	const monthCandidate = typeof rawMonth === "string" ? rawMonth : "";
	const selectedMonth: MonthKey = normalizeMonthKey(monthCandidate) ?? currentMonthKey();

	if (!rawYear || !rawMonth) {
		redirect(
			`/user=${encodeURIComponent(username)}/${encodeURIComponent(
				budgetPlanId
			)}/page=expense-category/${encodeURIComponent(categoryId)}?year=${encodeURIComponent(
				String(selectedYear)
			)}&month=${encodeURIComponent(selectedMonth)}`
		);
	}

	await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId });

	const categories = await prisma.category.findMany({
		where: { budgetPlanId },
		orderBy: { createdAt: "asc" },
	});

	let category: { id: string; name: string; icon: string | null; color: string | null; featured: boolean } | null = null;
	if (categoryId !== "uncategorized") {
		category = await prisma.category.findFirst({
			where: { id: categoryId, budgetPlanId },
			select: { id: true, name: true, icon: true, color: true, featured: true },
		});
		if (!category) return notFound();
	}

	const expensesByMonth = await getAllExpenses(budgetPlanId, selectedYear);
	const monthExpenses = expensesByMonth?.[selectedMonth] ?? [];
	const filteredExpenses = categoryId === "uncategorized"
		? monthExpenses.filter((e) => !e.categoryId)
		: monthExpenses.filter((e) => e.categoryId === categoryId);

	const creditCards = await prisma.debt.findMany({
		where: { budgetPlanId, type: { in: ["credit_card", "store_card"] } },
		select: { id: true, name: true },
		orderBy: { createdAt: "asc" },
	});

	const debts = await prisma.debt.findMany({
		where: { budgetPlanId, sourceType: null },
		select: { id: true, name: true, type: true },
		orderBy: { createdAt: "asc" },
	});

	return (
		<ExpenseCategoryPageClient
			budgetPlanId={budgetPlanId}
			planKind={plan.kind}
			payDate={plan.payDate}
			year={selectedYear}
			month={selectedMonth}
			categoryId={categoryId}
			category={
				category
					? {
						id: category.id,
						name: category.name,
						icon: category.icon ?? undefined,
						color: category.color ?? undefined,
						featured: category.featured,
					}
					: null
			}
			expenses={filteredExpenses}
			categories={categories.map((c) => ({
				id: c.id,
				name: c.name,
				icon: c.icon ?? undefined,
				color: c.color ?? undefined,
				featured: c.featured,
			}))}
			creditCards={creditCards}
			debts={debts}
		/>
	);
}
