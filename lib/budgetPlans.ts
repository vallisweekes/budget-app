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

export async function getOrCreateBudgetPlanForUser(params: {
	userId: string;
	budgetType: SupportedBudgetType;
}) {
	const { userId, budgetType } = params;

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
