import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import DashboardView from "@/app/dashboard/DashboardView";
import NewBudgetPageContent from "@/app/budgets/new/NewBudgetPageContent";
import { authOptions } from "@/lib/auth";
import {
	getBudgetPlanForUserByType,
	getDefaultBudgetPlanForUser,
	isSupportedBudgetType,
	resolveUserId,
} from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";

function parseUserBudget(slug: string[]) {
	if (slug.length < 3) return null;
	const [userSegmentRaw, secondSegmentRaw, thirdSegmentRaw, ...rest] = slug;
	const userSegment = decodeURIComponent(userSegmentRaw);
	if (!userSegment.startsWith("user=")) return null;

	const username = userSegment.slice("user=".length);
	if (!username) return null;

	const second = decodeURIComponent(secondSegmentRaw);
	const third = decodeURIComponent(thirdSegmentRaw);

	// Legacy canonical form: /user=<username>/id/<budgetRef>
	if (second === "id") {
		return { kind: "legacy" as const, username, budgetRef: third, rest: rest.map(decodeURIComponent) };
	}

	// New onboarding form: /user=<username>/<userId>/budgets/new
	return {
		kind: "userHash" as const,
		username,
		userHash: second,
		budgetRef: third,
		rest: rest.map(decodeURIComponent),
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
		const tail = parsed.rest.length ? `/${parsed.rest.map((s) => encodeURIComponent(s)).join("/")}` : "";
		if (parsed.kind === "userHash") {
			redirect(
				`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/${encodeURIComponent(
					parsed.budgetRef
				)}${tail}`
			);
		}
		redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(parsed.budgetRef)}${tail}`);
	}

	// New onboarding route: /user=<username>/<userId>/budgets/new
	if (parsed.kind === "userHash") {
		if (parsed.userHash !== userId) {
			const tail = parsed.rest.length ? `/${parsed.rest.map((s) => encodeURIComponent(s)).join("/")}` : "";
			redirect(
				`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/${encodeURIComponent(
					parsed.budgetRef
				)}${tail}`
			);
		}
		if (parsed.budgetRef === "budgets" && parsed.rest.length === 1 && parsed.rest[0] === "new") {
			return <NewBudgetPageContent searchParams={Promise.resolve(searchParams ?? {})} />;
		}
		return notFound();
	}

	// Legacy nested onboarding route: /user=<username>/id/budgets/new
	if (parsed.budgetRef === "budgets" && parsed.rest.length === 1 && parsed.rest[0] === "new") {
		redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(userId)}/budgets/new`);
	}

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
		redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(existing.id)}`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: parsed.budgetRef } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
		if (!fallbackPlan) {
			redirect("/budgets/new");
		}
		redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(fallbackPlan.id)}`);
	}

	return <DashboardView budgetPlanId={budgetPlan.id} />;
}
