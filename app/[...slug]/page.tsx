import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import DashboardView from "@/components/Dashboard/DashboardView";
import NewBudgetPageContent from "@/app/budgets/new/NewBudgetPageContent";
import AdminIncomePage from "@/app/admin/income/page";
import AdminExpensesPage from "@/app/admin/expenses/page";
import DebtsPage from "@/app/admin/debts/page";
import GoalsPage from "@/app/admin/goals/page";
import SpendingPage from "@/app/admin/spending/page";
import SettingsPageContent from "@/app/admin/settings/SettingsPageContent";
import AdminCategoriesPage from "@/app/admin/categories/page";
import { authOptions } from "@/lib/auth";
import {
	getBudgetPlanForUserByType,
	getDefaultBudgetPlanForUser,
	isSupportedBudgetType,
	resolveUserId,
} from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";

type ParsedUserBudget =
	| {
			kind: "legacy";
			username: string;
			budgetRef: string;
			rest: string[];
	  }
	| {
			kind: "onboarding";
			username: string;
			userHash: string;
			rest: string[];
	  }
	| {
			kind: "scoped";
			username: string;
			budgetPlanId: string;
			page: string[];
	  };

function parseUserBudget(slug: string[]): ParsedUserBudget | null {
	if (slug.length < 2) return null;
	const [userSegmentRaw, secondSegmentRaw, thirdSegmentRaw, ...rest] = slug;
	const userSegment = decodeURIComponent(userSegmentRaw);
	if (!userSegment.startsWith("user=")) return null;

	const username = userSegment.slice("user=".length);
	if (!username) return null;

	const second = decodeURIComponent(secondSegmentRaw);
	const third = thirdSegmentRaw == null ? "" : decodeURIComponent(thirdSegmentRaw);

	// Legacy canonical form: /user=<username>/id/<budgetRef>
	if (second === "id") {
		if (!third) return null;
		return { kind: "legacy", username, budgetRef: third, rest: rest.map(decodeURIComponent) };
	}

	// Onboarding form: /user=<username>/<userId>/budgets/new
	if (third === "budgets" && rest.length === 1 && decodeURIComponent(rest[0]) === "new") {
		return { kind: "onboarding", username, userHash: second, rest: rest.map(decodeURIComponent) };
	}

	// New canonical form: /user=<username>/<budgetPlanId>/<page...>
	return {
		kind: "scoped",
		username,
		budgetPlanId: second,
		page: [third, ...rest].filter(Boolean).map(decodeURIComponent),
	};
}

export default async function UserBudgetPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string[] }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { slug } = await params;
	const parsed = parseUserBudget(slug);
	if (!parsed) return notFound();

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) {
		redirect("/");
	}
	// Keep URLs unique per logged-in user by enforcing the username segment.
	// If someone pastes /user=other/id/... while logged-in, normalize to their own canonical path.
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	// Keep URLs unique per logged-in user by enforcing the username segment.
	// If someone pastes /user=other/... while logged-in, normalize to their own canonical path.
	if (sessionUsername !== parsed.username) {
		if (parsed.kind === "legacy") {
			const tail = parsed.rest.length ? `/${parsed.rest.map((s) => encodeURIComponent(s)).join("/")}` : "";
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(parsed.budgetRef)}${tail}`);
		}
		if (parsed.kind === "onboarding") {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/budgets/new`);
		}
		// scoped
		const tail = parsed.page.length ? `/${parsed.page.map((s) => encodeURIComponent(s)).join("/")}` : "";
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(parsed.budgetPlanId)}${tail}`);
	}

	// Onboarding route: /user=<username>/<userId>/budgets/new
	if (parsed.kind === "onboarding") {
		if (parsed.userHash !== userId) {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/budgets/new`);
		}
		return <NewBudgetPageContent searchParams={Promise.resolve(searchParams ?? {})} />;
	}

	if (parsed.kind === "legacy") {
		// Legacy nested onboarding route: /user=<username>/id/budgets/new
		if (parsed.budgetRef === "budgets" && parsed.rest.length === 1 && parsed.rest[0] === "new") {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/budgets/new`);
		}

		// Legacy: /user=<username>/id/<budgetType>
		if (isSupportedBudgetType(parsed.budgetRef)) {
			const existing = await getBudgetPlanForUserByType({
				userId,
				username: sessionUsername,
				budgetType: parsed.budgetRef,
			});
			if (!existing) {
				redirect(
					`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/budgets/new?type=${encodeURIComponent(
						parsed.budgetRef
					)}`
				);
			}
			const tail = parsed.rest.length ? `/${parsed.rest.map((s) => encodeURIComponent(s)).join("/")}` : "";
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(existing.id)}${tail}`);
		}

		// Legacy: /user=<username>/id/<budgetPlanId>
		const tail = parsed.rest.length ? `/${parsed.rest.map((s) => encodeURIComponent(s)).join("/")}` : "";
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(parsed.budgetRef)}${tail}`);
	}

	const resolvedSearchParams = (await searchParams) ?? {};

	const [pageKeyRaw, ...pageRest] = parsed.kind === "scoped" ? parsed.page : [];
	const rawSegment = (pageKeyRaw ?? "").toLowerCase();
	const pageKey = rawSegment.startsWith("page=") ? rawSegment.slice("page=".length) : rawSegment;

	// Allow /user=<username>/<userId>/page=settings so new users (no plan yet) can still reach Settings.
	if (parsed.kind === "scoped" && parsed.budgetPlanId === userId) {
		if (!rawSegment) {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/page=settings`);
		}
		if (pageKey !== "settings") {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/page=settings`);
		}
		return <SettingsPageContent searchParams={Promise.resolve({ ...resolvedSearchParams, plan: "" })} />;
	}

	// Scoped canonical route: /user=<username>/<budgetPlanId>/<page>
	const requestedPlan = await prisma.budgetPlan.findUnique({ where: { id: parsed.budgetPlanId } });
	if (!requestedPlan || requestedPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/page=settings`);
		}
		const tail = parsed.page.length ? `/${parsed.page.map((s) => encodeURIComponent(s)).join("/")}` : "";
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}${tail}`);
	}

	const budgetPlanId = requestedPlan.id;

	// Keep categories in sync for ALL users/plans, including older plans.
	await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId });
	const sp = { ...resolvedSearchParams, plan: budgetPlanId };

	const knownPages = new Set([
		"home",
		"dashboard",
		"income",
		"expenses",
		"spending",
		"debts",
		"goals",
		"settings",
		"categories",
	]);

	// Canonicalize base routes to always include page=<pageName>
	if (!rawSegment) {
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/page=home`);
	}

	// Canonicalize /dashboard -> /page=home
	if (pageKey === "dashboard") {
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/page=home`);
	}

	// Canonicalize old form /<page> -> /page=<page>
	if (!rawSegment.startsWith("page=") && knownPages.has(pageKey)) {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(resolvedSearchParams)) {
			const val = Array.isArray(v) ? v[0] : v;
			if (val == null) continue;
			qs.set(k, String(val));
		}
		const q = qs.toString();
		redirect(
			`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/page=${encodeURIComponent(
				pageKey
			)}${q ? `?${q}` : ""}`
		);
	}

	// Allow optional /home segment but treat it as dashboard.
	if (pageKey === "home") {
		return <DashboardView budgetPlanId={budgetPlanId} />;
	}

	// Support both /<planId>/<page> and /<planId>/admin/<page>
	if (pageKey === "admin") {
		const adminKey = (pageRest[0] ?? "").toLowerCase();
		if (!adminKey) return notFound();
		return renderUserScopedAdminPage(adminKey, budgetPlanId, sp);
	}

	// Canonicalize Expenses URL so year/month are always present.
	if (pageKey === "expenses") {
		const rawYear = resolvedSearchParams.year;
		const rawMonth = resolvedSearchParams.month;
		const yearVal = Array.isArray(rawYear) ? rawYear[0] : rawYear;
		const monthVal = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;
		if (!yearVal || !monthVal) {
			const y = new Date().getFullYear();
			const m = currentMonthKey();
			redirect(
				`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(
					budgetPlanId
				)}/page=expenses?year=${encodeURIComponent(
					String(y)
				)}&month=${encodeURIComponent(m)}`
			);
		}
	}

	return renderUserScopedAdminPage(pageKey, budgetPlanId, sp);
}

function renderUserScopedAdminPage(
	key: string,
	budgetPlanId: string,
	searchParams: Record<string, string | string[] | undefined>
) {
	switch (key) {
		case "income":
			return <AdminIncomePage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "expenses":
			return <AdminExpensesPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "spending":
			return <SpendingPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "debts":
			return <DebtsPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "goals":
			return <GoalsPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "settings":
			return <SettingsPageContent searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "categories":
			return <AdminCategoriesPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		default:
			return notFound();
	}
}
