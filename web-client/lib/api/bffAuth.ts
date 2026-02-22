import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUserId(): Promise<string | null> {
	const session = await getServerSession(authOptions);
	const userId = (session?.user as { id?: string } | null | undefined)?.id;
	return typeof userId === "string" && userId.trim() ? userId : null;
}

export async function resolveOwnedBudgetPlanId(params: {
	userId: string;
	budgetPlanId: string | null;
}): Promise<string | null> {
	const budgetPlanId = params.budgetPlanId?.trim();
	if (budgetPlanId) {
		const owned = await prisma.budgetPlan.findFirst({
			where: { id: budgetPlanId, userId: params.userId },
			select: { id: true },
		});
		return owned?.id ?? null;
	}

	// Prefer a "personal" plan (matches web client's getDefaultBudgetPlanForUser logic)
	const personal = await prisma.budgetPlan.findFirst({
		where: { userId: params.userId, kind: "personal" },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});
	if (personal) return personal.id;

	// Fall back to the most recent plan of any kind
	const plan = await prisma.budgetPlan.findFirst({
		where: { userId: params.userId },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});

	return plan?.id ?? null;
}
