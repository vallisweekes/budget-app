import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { withPrismaRetry } from "@/lib/prismaRetry";
import { normalizeUsername } from "@/lib/helpers/username";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";

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

async function seedStarterDataForPlan(params: { budgetPlanId: string }) {
	const { budgetPlanId } = params;
	const now = new Date();
	const month = now.getMonth() + 1;
	const year = now.getFullYear();

	const [existingIncome, existingExpense, existingGoal, firstCategory] = await Promise.all([
		withPrismaRetry(
			() => prisma.income.findFirst({ where: { budgetPlanId }, select: { id: true } }),
			{ retries: 2, delayMs: 150 }
		),
		withPrismaRetry(
			() => prisma.expense.findFirst({ where: { budgetPlanId, isAllocation: false }, select: { id: true } }),
			{ retries: 2, delayMs: 150 }
		),
		withPrismaRetry(
			() => prisma.goal.findFirst({ where: { budgetPlanId }, select: { id: true } }),
			{ retries: 2, delayMs: 150 }
		),
		withPrismaRetry(
			() => prisma.category.findFirst({ where: { budgetPlanId }, select: { id: true }, orderBy: { createdAt: "asc" } }),
			{ retries: 2, delayMs: 150 }
		),
	]);

	const writes: Array<Promise<unknown>> = [];

	if (!existingIncome) {
		writes.push(
			withPrismaRetry(
				() =>
					prisma.income.create({
						data: {
							budgetPlanId,
							name: "Starter income (Edit me)",
							amount: 3000,
							month,
							year,
						},
					}),
				{ retries: 2, delayMs: 150 }
			)
		);
	}

	if (!existingExpense) {
		writes.push(
			withPrismaRetry(
				() =>
					prisma.expense.create({
						data: {
							budgetPlanId,
							name: "Starter expense (Edit me)",
							amount: 250,
							paid: false,
							paidAmount: 0,
							isAllocation: false,
							month,
							year,
							categoryId: firstCategory?.id ?? null,
						},
					}),
				{ retries: 2, delayMs: 150 }
			)
		);
	}

	if (!existingGoal) {
		writes.push(
			withPrismaRetry(
				() =>
					prisma.goal.create({
						data: {
							budgetPlanId,
							title: "Starter goal (Edit me)",
							type: "short_term",
							category: "savings",
							description: "Replace this with your real goal and target.",
							targetAmount: 1000,
							currentAmount: 0,
							targetYear: year,
						},
					}),
				{ retries: 2, delayMs: 150 }
			)
		);
	}

	if (writes.length > 0) {
		await Promise.all(writes);
	}
}

export async function getOrCreateUserByUsername(username: string) {
	const normalized = normalizeUsername(username);
	if (!normalized) {
		throw new Error("Username is required");
	}

	const existing = await withPrismaRetry(
		() =>
			prisma.user.findFirst({
		where: {
			name: {
				equals: normalized,
				mode: "insensitive",
			},
		},
		}),
		{ retries: 2, delayMs: 150 }
	);
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
	return withPrismaRetry(
		() =>
			prisma.user.findFirst({
				where: {
					name: {
						equals: normalized,
						mode: "insensitive",
					},
				},
			}),
		{ retries: 2, delayMs: 150 }
	);
}

export async function registerUserByUsername(params: { username: string; email: string }) {
	const username = normalizeUsername(params.username);
	const email = normalizeEmail(params.email);

	if (!username) throw new Error("Username is required");
	if (!email) throw new Error("Email is required");
	if (!isValidEmail(email)) throw new Error("Invalid email address");

	const existingByEmail = await withPrismaRetry(
		() => prisma.user.findUnique({ where: { email }, select: { id: true, name: true } }),
		{ retries: 2, delayMs: 150 }
	);
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
		const byId = await withPrismaRetry(
			() => prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
			{ retries: 2, delayMs: 150 }
		);
		if (byId) {
			if (!normalizedUsername) return byId.id;
			const byIdName = String(byId.name ?? "").trim();
			if (byIdName && byIdName.localeCompare(normalizedUsername, undefined, { sensitivity: "accent" }) === 0) {
				return byId.id;
			}

			const byUsername = await withPrismaRetry(
				() =>
					prisma.user.findFirst({
						where: {
							name: {
								equals: normalizedUsername,
								mode: "insensitive",
							},
						},
						select: { id: true },
					}),
				{ retries: 2, delayMs: 150 }
			);
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
		const existing = await withPrismaRetry(
			() =>
				prisma.budgetPlan.findFirst({
			where: {
				userId,
				kind: "personal",
			},
			orderBy: { createdAt: "desc" },
			}),
			{ retries: 2, delayMs: 150 }
		);
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
		await seedStarterDataForPlan({ budgetPlanId: created.id });
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
	const personal = (await withPrismaRetry(
		() =>
			prisma.budgetPlan.findFirst({
		where: { userId, kind: "personal" },
		select,
		} as any),
		{ retries: 2, delayMs: 150 }
	)) as PersonalSeed | null;
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
	await seedStarterDataForPlan({ budgetPlanId: created.id });
	return created;
}

export async function getBudgetPlanForUserByType(params: {
	userId?: string;
	username?: string;
	budgetType: SupportedBudgetType;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return withPrismaRetry(
		() =>
			prisma.budgetPlan.findFirst({
				where: { userId, kind: params.budgetType },
				orderBy: { createdAt: "desc" },
			}),
		{ retries: 2, delayMs: 150 }
	);
}

export async function getDefaultBudgetPlanForUser(params: {
	userId?: string;
	username?: string;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });

	// Prefer Personal if it exists, otherwise fall back to the most recent plan.
	const personal = await withPrismaRetry(
		() =>
			prisma.budgetPlan.findFirst({
		where: { userId, kind: "personal" },
		orderBy: { createdAt: "desc" },
		}),
		{ retries: 2, delayMs: 150 }
	);
	if (personal) return personal;

	return withPrismaRetry(
		() => prisma.budgetPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
		{ retries: 2, delayMs: 150 }
	);
}

export async function listBudgetPlansForUser(params: {
	userId?: string;
	username?: string;
}) {
	const userId = await resolveUserId({ userId: params.userId, username: params.username });
	return withPrismaRetry(
		() =>
			prisma.budgetPlan.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
			}),
		{ retries: 2, delayMs: 150 }
	);
}
