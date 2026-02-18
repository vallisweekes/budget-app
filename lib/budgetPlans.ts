import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { normalizeUsername } from "@/lib/helpers/username";

export const SUPPORTED_BUDGET_TYPES = ["personal", "holiday", "carnival"] as const;
export type SupportedBudgetType = (typeof SUPPORTED_BUDGET_TYPES)[number];

export function isSupportedBudgetType(value: string): value is SupportedBudgetType {
	return (SUPPORTED_BUDGET_TYPES as readonly string[]).includes(value);
}

function prismaBudgetPlanHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.BudgetPlan?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

export async function getOrCreateUserByUsername(username: string) {
	const normalized = normalizeUsername(username);
	if (!normalized) {
		throw new Error("Username is required");
	}

	const existing = await prisma.user.findFirst({
		where: {
			name: {
				equals: normalized,
				mode: "insensitive",
			},
		},
	});
	if (existing) return existing;

	return prisma.user.create({
		data: {
			name: normalized,
		},
	});
}

export async function getUserByUsername(username: string) {
	const normalized = normalizeUsername(username);
	if (!normalized) return null;
	return prisma.user.findFirst({
		where: {
			name: {
				equals: normalized,
				mode: "insensitive",
			},
		},
	});
}

export async function registerUserByUsername(params: { username: string; email: string }) {
	const username = normalizeUsername(params.username);
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
	const normalizedUsername = normalizeUsername(username ?? "");

	if (userId) {
		// PWA sessions can get stale across DB resets / migrations. If the session's
		// userId points at a different (or "ghost") user than the current username,
		// prefer resolving by username so we don't strand the user on a fresh account.
		const byId = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
		if (byId) {
			if (!normalizedUsername) return byId.id;
			const byIdName = String(byId.name ?? "").trim();
			if (byIdName && byIdName.localeCompare(normalizedUsername, undefined, { sensitivity: "accent" }) === 0) {
				return byId.id;
			}

			const byUsername = await prisma.user.findFirst({
				where: {
					name: {
						equals: normalizedUsername,
						mode: "insensitive",
					},
				},
				select: { id: true },
			});
			return byUsername?.id ?? byId.id;
		}
	}

	if (!normalizedUsername) {
		throw new Error("Unable to resolve user id: missing username.");
	}

	const user = await getOrCreateUserByUsername(normalizedUsername);
	return user.id;
}

export async function getOrCreateBudgetPlanForUser(params: {
	userId?: string;
	username?: string;
	budgetType: SupportedBudgetType;
	planName?: string;
	eventDate?: Date | null;
	includePostEventIncome?: boolean;
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

	// Require a Personal plan before creating Holiday/Carnival.
	type PersonalSeed = {
		id: string;
		payDate: number;
		country: string;
		language: string;
		currency: string;
		savingsBalance: unknown;
		emergencyBalance?: unknown;
	};
	const select: any = {
		id: true,
		payDate: true,
		country: true,
		language: true,
		currency: true,
		savingsBalance: true,
	};
	if (prismaBudgetPlanHasField("emergencyBalance")) {
		select.emergencyBalance = true;
	}
	const personal = (await prisma.budgetPlan.findFirst({
		where: { userId, kind: "personal" },
		select,
	} as any)) as PersonalSeed | null;
	if (!personal) {
		throw new Error("Personal budget required");
	}

	const eventDate = params.eventDate ?? null;
	if (!eventDate) {
		throw new Error("Event date required");
	}
	const includePostEventIncome = Boolean(params.includePostEventIncome);

	// Holiday/Carnival: allow multiple plans.
	const fallbackName = budgetType === "holiday" ? "Holiday" : "Carnival";
	const data: any = {
		userId,
		kind: budgetType,
		name: planName || fallbackName,
		eventDate,
		includePostEventIncome,
		// Seed these from the Personal plan so Holiday/Carnival budgeting starts grounded.
		payDate: personal.payDate,
		country: personal.country,
		language: personal.language,
		currency: personal.currency,
		savingsBalance: personal.savingsBalance as any,
	};
	if (prismaBudgetPlanHasField("emergencyBalance")) {
		data.emergencyBalance = (personal as any).emergencyBalance ?? 0;
	}
	const created = await prisma.budgetPlan.create({
		data,
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
