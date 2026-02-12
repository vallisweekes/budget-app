"use server";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getOrCreateBudgetPlanForUser, isSupportedBudgetType, resolveUserId } from "@/lib/budgetPlans";

export async function createBudgetPlanAction(formData: FormData) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		redirect("/");
	}

	const budgetTypeRaw = String(formData.get("budgetType") ?? "personal").trim().toLowerCase();
	const budgetType = isSupportedBudgetType(budgetTypeRaw) ? budgetTypeRaw : "personal";

	const userId = await resolveUserId({ userId: sessionUser.id, username });
	const plan = await getOrCreateBudgetPlanForUser({ userId, username, budgetType });

	redirect(`/user=${encodeURIComponent(username)}/id/${encodeURIComponent(plan.id)}`);
}
