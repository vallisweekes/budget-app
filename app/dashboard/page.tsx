import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getOrCreateBudgetPlanForUser, isSupportedBudgetType } from "@/lib/budgetPlans";

export default async function DashboardPage() {
	const session = await getServerSession(authOptions);
	const username = session?.user?.username ?? session?.user?.name;
	if (!username) {
		redirect("/");
	}

	if (session.user?.budgetPlanId) {
		redirect(`/user=${encodeURIComponent(username)}/id/${encodeURIComponent(session.user.budgetPlanId)}`);
	}

	const budgetTypeRaw = session.user?.budgetType ?? "personal";
	const budgetType = isSupportedBudgetType(budgetTypeRaw) ? budgetTypeRaw : "personal";
	const userId = (session.user as any).id as string | undefined;
	if (!userId) {
		redirect("/");
	}
	const budgetPlan = await getOrCreateBudgetPlanForUser({ userId, budgetType });
	redirect(`/user=${encodeURIComponent(username)}/id/${encodeURIComponent(budgetPlan.id)}`);
}

