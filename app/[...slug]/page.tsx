import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import DashboardView from "@/app/dashboard/DashboardView";
import NewBudgetPageContent from "@/app/budgets/new/NewBudgetPageContent";
import AdminIncomePage from "@/app/admin/income/page";
import AdminExpensesPage from "@/app/admin/expenses/page";
import DebtsPage from "@/app/admin/debts/page";
import GoalsPage from "@/app/admin/goals/page";
import SpendingPage from "@/app/admin/spending/page";
import AdminSettingsPage from "@/app/admin/settings/page";
import AdminCategoriesPage from "@/app/admin/categories/page";
import { authOptions } from "@/lib/auth";
import {
	getBudgetPlanForUserByType,
	getDefaultBudgetPlanForUser,
	isSupportedBudgetType,
	resolveUserId,
} from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";

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
	searchParams?: Record<string, string | string[] | undefined>;
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

	// Scoped canonical route: /user=<username>/<budgetPlanId>/<page>
	const requestedPlan = await prisma.budgetPlan.findUnique({ where: { id: parsed.budgetPlanId } });
	if (!requestedPlan || requestedPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) redirect("/budgets/new");
		const tail = parsed.page.length ? `/${parsed.page.map((s) => encodeURIComponent(s)).join("/")}` : "";
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallbackPlan.id)}${tail}`);
	}

	const budgetPlanId = requestedPlan.id;
	const sp = { ...(searchParams ?? {}), plan: budgetPlanId };

	const [pageKeyRaw, ...pageRest] = parsed.page;
	const pageKey = (pageKeyRaw ?? "").toLowerCase();

	// Allow optional /dashboard segment but treat base as dashboard.
	if (!pageKey || pageKey === "dashboard") {
		return <DashboardView budgetPlanId={budgetPlanId} />;
	}

	// Support both /<planId>/<page> and /<planId>/admin/<page>
	if (pageKey === "admin") {
		const adminKey = (pageRest[0] ?? "").toLowerCase();
		if (!adminKey) return notFound();
		return renderUserScopedAdminPage(adminKey, budgetPlanId, sp);
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
			return <AdminSettingsPage searchParams={Promise.resolve({ ...searchParams, plan: budgetPlanId })} />;
		case "categories":
			return <AdminCategoriesPage />;
		default:
			return notFound();
	}
}
