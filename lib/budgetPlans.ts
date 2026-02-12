import { prisma } from "@/lib/prisma";

export const SUPPORTED_BUDGET_TYPES = ["personal", "holiday", "carnival"] as const;
export type SupportedBudgetType = (typeof SUPPORTED_BUDGET_TYPES)[number];

export function isSupportedBudgetType(value: string): value is SupportedBudgetType {
	return (SUPPORTED_BUDGET_TYPES as readonly string[]).includes(value);
}

export async function getOrCreateUserByUsername(username: string) {
	const existing = await prisma.user.findFirst({ where: { name: username } });
	if (existing) return existing;

	return prisma.user.create({
		data: {
			name: username,
		},
	});
}

export async function resolveUserId(params: {
	userId?: string;
	username?: string;
}): Promise<string> {
	const { userId, username } = params;

	if (userId) {
		const existing = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (existing) return existing.id;
	}

	if (!username) {
		throw new Error("Unable to resolve user id: missing username.");
	}

	const user = await getOrCreateUserByUsername(username);
	return user.id;
}

export async function getOrCreateBudgetPlanForUser(params: {
	userId?: string;
	username?: string;
	budgetType: SupportedBudgetType;
}) {
	const { budgetType } = params;
	const userId = await resolveUserId({ userId: params.userId, username: params.username });

	const existing = await prisma.budgetPlan.findFirst({
		where: {
			userId,
			name: budgetType,
		},
	});
	if (existing) return existing;

	return prisma.budgetPlan.create({
		data: {
			userId,
			name: budgetType,
		},
	});
}

export async function getBudgetPlanForUserByType(params: {
	userId?: string;
	username?: string;
	budgetType: SupportedBudgetType;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return prisma.budgetPlan.findFirst({
		where: { userId, name: params.budgetType },
		orderBy: { createdAt: "desc" },
	});
}

export async function getDefaultBudgetPlanForUser(params: {
	userId?: string;
	username?: string;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return prisma.budgetPlan.findFirst({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
}

export async function listBudgetPlansForUser(params: {
	userId?: string;
	username?: string;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return prisma.budgetPlan.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
}
