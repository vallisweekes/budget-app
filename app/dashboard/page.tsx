import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";

export default async function DashboardPage() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		redirect("/");
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });
	const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username });
	if (!budgetPlan) {
		redirect("/budgets/new");
	}
	redirect(`/user=${encodeURIComponent(username)}/id/${encodeURIComponent(budgetPlan.id)}`);
}

