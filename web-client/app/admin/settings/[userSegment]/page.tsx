import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";

export const dynamic = "force-dynamic";

export default async function AdminUserSettingsPage({
	params,
}: {
	params: Promise<{ userSegment: string }>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	
	if (!sessionUser || !sessionUsername) {
		redirect("/");
	}

	const { userSegment } = await params;
	
	if (!userSegment.startsWith("user=")) {
		redirect("/");
	}
	
	const requestedUsername = decodeURIComponent(userSegment.slice("user=".length));
	
	if (requestedUsername !== sessionUsername) {
		redirect(`/admin/settings/user=${encodeURIComponent(sessionUsername)}`);
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
	const idSegment = budgetPlan?.id ? budgetPlan.id : userId;
	redirect(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(idSegment)}/page=settings`);
}
