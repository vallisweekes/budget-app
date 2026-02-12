import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import DashboardView from "@/app/dashboard/DashboardView";
import { authOptions } from "@/lib/auth";
import { getOrCreateBudgetPlanForUser, isSupportedBudgetType } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";

const SUPPORTED_BUDGET_TYPES = new Set(["personal", "holiday", "carnival"]);

function parseUserBudget(slug: string[]) {
	if (slug.length !== 3) return null;
	const [userSegmentRaw, idSegment, budgetTypeRaw] = slug;
	const userSegment = decodeURIComponent(userSegmentRaw);
	if (!userSegment.startsWith("user=")) return null;
	if (idSegment !== "id") return null;

	const username = userSegment.slice("user=".length);
	const budgetRef = decodeURIComponent(budgetTypeRaw);
	if (!username) return null;
	return { username, budgetRef };
}

export default async function UserBudgetPage({
	params,
}: {
	params: Promise<{ slug: string[] }>;
}) {
	const { slug } = await params;
	const parsed = parseUserBudget(slug);
	if (!parsed) return notFound();

	const session = await getServerSession(authOptions);
	const sessionUsername = session?.user?.username ?? session?.user?.name;
	const sessionBudgetType = session?.user?.budgetType ?? "personal";
	const sessionBudgetPlanId = session?.user?.budgetPlanId;
	if (!sessionUsername) {
		redirect("/");
	}
	if (sessionUsername !== parsed.username) {
		if (sessionBudgetPlanId) {
			redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(sessionBudgetPlanId)}`);
		}
		redirect("/dashboard");
	}

	const userId = (session.user as any).id as string | undefined;
	if (!userId) redirect("/");

	if (isSupportedBudgetType(parsed.budgetRef)) {
		const budgetPlan = await getOrCreateBudgetPlanForUser({ userId, budgetType: parsed.budgetRef });
		redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(budgetPlan.id)}`);
	}

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: parsed.budgetRef } });
	if (!budgetPlan || budgetPlan.userId !== userId) {
		const fallbackType = isSupportedBudgetType(sessionBudgetType) ? sessionBudgetType : "personal";
		const fallbackPlan = await getOrCreateBudgetPlanForUser({ userId, budgetType: fallbackType });
		redirect(`/user=${encodeURIComponent(sessionUsername)}/id/${encodeURIComponent(fallbackPlan.id)}`);
	}

	return <DashboardView />;
}
