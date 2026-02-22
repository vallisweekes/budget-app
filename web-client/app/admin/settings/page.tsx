import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
	const idSegment = budgetPlan?.id ? budgetPlan.id : userId;
	redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(idSegment)}/page=settings`);
}
