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
	const planName = String(formData.get("planName") ?? "").trim();
	const returnToRaw = String(formData.get("returnTo") ?? "").trim();
	const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "";

	const userId = await resolveUserId({ userId: sessionUser.id, username });
	try {
		const plan = await getOrCreateBudgetPlanForUser({ userId, username, budgetType, planName });
		if (returnTo) {
			redirect(returnTo);
		}
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(plan.id)}`);
	} catch (e) {
		const message = (e as { message?: string } | null)?.message ?? "";
		if (message.includes("Personal budget required")) {
			redirect(
				`/user=${encodeURIComponent(username)}/${encodeURIComponent(userId)}/budgets/new?type=personal&error=personal_required${
					returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
				}`
			);
		}
		throw e;
	}
}
