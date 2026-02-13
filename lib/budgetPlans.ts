import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";

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

export async function getUserByUsername(username: string) {
	const normalized = String(username ?? "").trim();
	if (!normalized) return null;
	return prisma.user.findFirst({ where: { name: normalized } });
}

export async function registerUserByUsername(params: { username: string; email: string }) {
	const username = String(params.username ?? "").trim();
	const email = String(params.email ?? "")
		.trim()
		.toLowerCase();

	if (!username) throw new Error("Username is required");
	if (!email) throw new Error("Email is required");
	if (!email.includes("@")) throw new Error("Invalid email");

	const existingByEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
	if (existingByEmail && existingByEmail.name !== username) {
		throw new Error("Email already in use");
	}

	const existing = await getUserByUsername(username);
	if (existing) {
		throw new Error("User already exists");
	}

	return prisma.user.create({
		data: {
			name: username,
			email,
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
	planName?: string;
}) {
	const { budgetType } = params;
	const userId = await resolveUserId({ userId: params.userId, username: params.username });

	const planName = String(params.planName ?? "").trim();

	// Enforce only one Personal plan. If it exists, return it.
	if (budgetType === "personal") {
		const existing = await prisma.budgetPlan.findFirst({
			where: {
				userId,
				kind: "personal",
			},
			orderBy: { createdAt: "desc" },
		});
		if (existing) {
			await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: existing.id });
			return existing;
		}

		const created = await prisma.budgetPlan.create({
			data: {
				userId,
				kind: "personal",
				name: planName || "Personal",
			},
		});
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: created.id });
		return created;
	}

	// Holiday/Carnival: allow multiple plans.
	const fallbackName = budgetType === "holiday" ? "Holiday" : "Carnival";
	const created = await prisma.budgetPlan.create({
		data: {
			userId,
			kind: budgetType,
			name: planName || fallbackName,
		},
	});
	await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: created.id });
	return created;
}

export async function getBudgetPlanForUserByType(params: {
	userId?: string;
	username?: string;
	budgetType: SupportedBudgetType;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return prisma.budgetPlan.findFirst({
		where: { userId, kind: params.budgetType },
		orderBy: { createdAt: "desc" },
	});
}

export async function getDefaultBudgetPlanForUser(params: {
	userId?: string;
	username?: string;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });

	// Prefer Personal if it exists, otherwise fall back to the most recent plan.
	const personal = await prisma.budgetPlan.findFirst({
		where: { userId, kind: "personal" },
		orderBy: { createdAt: "desc" },
	});
	if (personal) return personal;

	return prisma.budgetPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
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
