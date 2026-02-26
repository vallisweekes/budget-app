"use server";

import { revalidatePath } from "next/cache";
import { addDebt, updateDebt, deleteDebt, addPayment, getDebtById, undoMostRecentPayment } from "./store";
import type { DebtType, MonthKey } from "@/types";
import { applyExpensePayment, setExpensePaymentAmount } from "@/lib/expenses/store";
import { upsertExpenseDebt } from "./store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { mapDebtPaymentSourceToExpensePaymentSource, syncExpensePaymentsToPaidAmount } from "@/lib/expenses/paymentSync";

function parseDateOnlyYYYYMMDD(value: unknown): string | undefined {
	const raw = String(value ?? "").trim();
	if (!raw) return undefined;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		throw new Error("Due date must be a valid date");
	}
	const dt = new Date(`${raw}T00:00:00.000Z`);
	if (!Number.isFinite(dt.getTime())) {
		throw new Error("Due date must be a valid date");
	}
	return dt.toISOString();
}

function requireBudgetPlanId(formData: FormData): string {
	const raw = formData.get("budgetPlanId");
	const budgetPlanId = String(raw ?? "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");
	return budgetPlanId;
}

async function requireAuthenticatedUser() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) throw new Error("Not authenticated");
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	return { userId, username: sessionUsername };
}

async function requireOwnedBudgetPlan(budgetPlanId: string, userId: string) {
	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, userId: true } });
	if (!plan || plan.userId !== userId) throw new Error("Budget plan not found");
	return plan;
}

export async function createDebt(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const name = formData.get("name") as string;
	const type = formData.get("type") as DebtType;
	const dueDate = parseDateOnlyYYYYMMDD(formData.get("dueDate"));
	const dueDayRaw = formData.get("dueDay");
	const dueDay =
		dueDate != null
			? undefined
			: dueDayRaw != null && String(dueDayRaw).trim() !== ""
				? parseInt(String(dueDayRaw), 10)
				: undefined;
	const rawDefaultPaymentSource = String(formData.get("defaultPaymentSource") ?? "income").trim();
	const defaultPaymentSource =
		rawDefaultPaymentSource === "credit_card"
			? "credit_card"
			: rawDefaultPaymentSource === "extra_funds"
				? "extra_funds"
				: "income";
	const defaultPaymentCardDebtId = String(formData.get("defaultPaymentCardDebtId") ?? "").trim();
	const initialBalance = parseFloat(formData.get("initialBalance") as string);
	const creditLimitRaw = formData.get("creditLimit");
	const creditLimit = creditLimitRaw != null && String(creditLimitRaw).trim() !== ""
		? parseFloat(String(creditLimitRaw))
		: undefined;
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths");
	const installmentMonthsText = installmentMonthsRaw == null ? "" : String(installmentMonthsRaw).trim();
	const installmentMonths = installmentMonthsText ? parseInt(installmentMonthsText, 10) : undefined;

	if (!name || !type || isNaN(initialBalance)) {
		throw new Error("Invalid input");
	}

	if (dueDay != null) {
		if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
			throw new Error("Due day must be between 1 and 31");
		}
	}

	if (defaultPaymentSource === "credit_card" && !defaultPaymentCardDebtId) {
		throw new Error("Default card is required when payment source is credit card");
	}

	if (type === "credit_card" || (type as any) === "store_card") {
		if (creditLimit == null || !Number.isFinite(creditLimit) || creditLimit <= 0) {
			throw new Error("Credit limit is required for credit card debts");
		}
	}

	await addDebt(budgetPlanId, {
		name,
		type,
		dueDay,
		dueDate,
		defaultPaymentSource,
		defaultPaymentCardDebtId: defaultPaymentSource === "credit_card" ? defaultPaymentCardDebtId : undefined,
		creditLimit,
		initialBalance,
		monthlyMinimum,
		interestRate,
		installmentMonths,
	});

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

// Cards must be created via Settings so credit limits stay centralized.
export async function createNonCardDebtAction(formData: FormData) {
	const type = formData.get("type") as DebtType;
	if (type === "credit_card" || (type as any) === "store_card") {
		throw new Error("Cards must be added in Settings → Savings and Cards.");
	}
	return createDebt(formData);
}

export async function updateDebtAction(id: string, formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const existing = await getDebtById(budgetPlanId, id);
	if (!existing) throw new Error("Debt not found");

	const name = formData.get("name") as string;
	const dueDate = parseDateOnlyYYYYMMDD(formData.get("dueDate"));
	const dueDayRaw = formData.get("dueDay");
	const dueDay =
		dueDate != null
			? undefined
			: dueDayRaw != null && String(dueDayRaw).trim() !== ""
				? parseInt(String(dueDayRaw), 10)
				: undefined;
	const rawDefaultPaymentSource = formData.get("defaultPaymentSource");
	const defaultPaymentSource =
		rawDefaultPaymentSource == null
			? undefined
			: String(rawDefaultPaymentSource).trim() === "credit_card"
				? "credit_card"
				: String(rawDefaultPaymentSource).trim() === "extra_funds"
					? "extra_funds"
					: "income";
	const defaultPaymentCardDebtId = String(formData.get("defaultPaymentCardDebtId") ?? "").trim();
	const initialBalance = formData.get("initialBalance") ? parseFloat(formData.get("initialBalance") as string) : undefined;
	const currentBalance = parseFloat(formData.get("currentBalance") as string);
	const amount = formData.get("amount") ? parseFloat(formData.get("amount") as string) : undefined;
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths");
	let installmentMonths: number | null | undefined = undefined;
	if (installmentMonthsRaw !== null) {
		const text = String(installmentMonthsRaw).trim();
		if (!text) {
			installmentMonths = null;
		} else {
			const parsed = parseInt(text, 10);
			installmentMonths = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
		}
	}

	if (!name || isNaN(currentBalance)) {
		throw new Error("Invalid input");
	}

	if (dueDay != null) {
		if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
			throw new Error("Due day must be between 1 and 31");
		}
	}

	if (defaultPaymentSource === "credit_card" && !defaultPaymentCardDebtId) {
		throw new Error("Default card is required when payment source is credit card");
	}

	if (existing.sourceType === "expense" && existing.sourceExpenseId) {
		const expense = await prisma.expense.findFirst({
			where: { id: existing.sourceExpenseId, budgetPlanId },
			select: { id: true, amount: true, paidAmount: true, paymentSource: true, cardDebtId: true },
		});
		if (!expense) throw new Error("Source expense not found");

		const expenseAmount = Number((expense.amount as any)?.toString?.() ?? expense.amount);
		let nextExpenseAmount = Number.isFinite(initialBalance as number)
			? Math.max(0, initialBalance as number)
			: expenseAmount;

		if (currentBalance > nextExpenseAmount) {
			nextExpenseAmount = currentBalance;
		}

		const nextPaidAmount = Math.max(0, Math.min(nextExpenseAmount, nextExpenseAmount - currentBalance));
		const nextPaid = nextExpenseAmount > 0 && nextPaidAmount >= nextExpenseAmount;

		await prisma.expense.update({
			where: { id: expense.id },
			data: {
				name,
				amount: nextExpenseAmount,
				paidAmount: nextPaid ? nextExpenseAmount : nextPaidAmount,
				paid: nextPaid,
			},
		});

		await syncExpensePaymentsToPaidAmount({
			expenseId: expense.id,
			budgetPlanId,
			amount: nextExpenseAmount,
			desiredPaidAmount: nextPaid ? nextExpenseAmount : nextPaidAmount,
			paymentSource: (expense as any).paymentSource ?? "income",
			cardDebtId: (expense as any).cardDebtId ?? null,
			adjustBalances: false,
			resetOnDecrease: true,
		});

		await updateDebt(budgetPlanId, id, {
			name,
			dueDay: dueDate != null ? (null as any) : dueDay,
			dueDate,
			defaultPaymentSource,
			defaultPaymentCardDebtId:
				defaultPaymentSource === undefined
					? undefined
					: defaultPaymentSource === "credit_card"
						? defaultPaymentCardDebtId
						: (null as any),
			initialBalance: nextExpenseAmount,
			currentBalance,
			paid: nextPaid,
			paidAmount: nextPaid ? nextExpenseAmount : nextPaidAmount,
			amount,
			monthlyMinimum,
			interestRate,
			installmentMonths: installmentMonths as any,
		});
	} else {
		await updateDebt(budgetPlanId, id, {
			name,
			dueDay: dueDate != null ? (null as any) : dueDay,
			dueDate,
			defaultPaymentSource,
			defaultPaymentCardDebtId:
				defaultPaymentSource === undefined
					? undefined
					: defaultPaymentSource === "credit_card"
						? defaultPaymentCardDebtId
						: (null as any),
			initialBalance,
			currentBalance,
			amount,
			monthlyMinimum,
			interestRate,
			installmentMonths: installmentMonths as any,
		});
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function updateCardSettingsAction(cardDebtId: string, formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const debt = await prisma.debt.findFirst({
		where: { id: cardDebtId, budgetPlanId, sourceType: null },
		select: { id: true, type: true, name: true },
	});
	if (!debt) throw new Error("Card not found");
	if (debt.type !== "credit_card" && (debt.type as any) !== "store_card") {
		throw new Error("Selected debt is not a card");
	}

	const creditLimitRaw = formData.get("creditLimit");
	const creditLimit =
		creditLimitRaw != null && String(creditLimitRaw).trim() !== ""
			? Number(creditLimitRaw)
			: undefined;
	if (creditLimit == null || !Number.isFinite(creditLimit) || creditLimit <= 0) {
		throw new Error("Credit limit must be a positive number");
	}

	const initialRaw = formData.get("initialBalance");
	const currentRaw = formData.get("currentBalance");
	let initialBalance = initialRaw == null ? NaN : Number(initialRaw);
	let currentBalance = currentRaw == null ? NaN : Number(currentRaw);
	if (!Number.isFinite(initialBalance) || initialBalance < 0) {
		throw new Error("Initial balance must be 0 or more");
	}
	if (!Number.isFinite(currentBalance) || currentBalance < 0) {
		throw new Error("Current balance must be 0 or more");
	}

	// Keep invariants stable across the app.
	currentBalance = Math.max(0, currentBalance);
	initialBalance = Math.max(initialBalance, currentBalance);
	const paidAmount = Math.max(0, Math.min(initialBalance, initialBalance - currentBalance));
	const paid = currentBalance === 0;

	await updateDebt(budgetPlanId, debt.id, {
		creditLimit,
		initialBalance,
		currentBalance,
		paidAmount,
		paid,
	});

	const settingsPath = `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/page=settings`;
	const debtsPath = `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/page=debts`;
	revalidatePath(settingsPath);
	revalidatePath(debtsPath);
	revalidatePath("/admin/debts");
	revalidatePath("/dashboard");
	revalidatePath("/");
}

export async function deleteDebtAction(budgetPlanId: string, id: string) {
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const existing = await getDebtById(budgetPlanId, id);
	if (existing?.sourceType === "expense" && existing.currentBalance > 0) {
		throw new Error("Cannot delete an unpaid expense debt. Mark the expense as paid first.");
	}
	await deleteDebt(budgetPlanId, id);
	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function makePaymentAction(budgetPlanId: string, debtId: string, amount: number, month: string) {
	if (isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment amount");
	}
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const payment = await addPayment(budgetPlanId, debtId, amount, month, "income");
	if (!payment) throw new Error("Debt not found");
	const appliedAmount = payment.amount;

	const debt = await getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			appliedAmount
		);
		if (result) {
			await syncExpensePaymentsToPaidAmount({
				expenseId: result.expense.id,
				budgetPlanId,
				amount: result.expense.amount,
				desiredPaidAmount: result.expense.paidAmount ?? 0,
				paymentSource: "income",
				adjustBalances: false,
				resetOnDecrease: false,
			});

			await upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				categoryId: result.expense.categoryId,
				categoryName: debt.sourceCategoryName,
				expenseName: result.expense.name,
				remainingAmount: result.remaining,
			});
		}
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function makePaymentFromForm(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const debtId = formData.get("debtId") as string;
	const amount = parseFloat(formData.get("amount") as string);
	const month = formData.get("month") as string;
	const rawSource = String(formData.get("source") ?? "income").trim();
	const source = rawSource === "credit_card" ? "credit_card" : rawSource === "extra_funds" ? "extra_funds" : "income";
	const cardDebtId = String(formData.get("cardDebtId") ?? "").trim();

	if (!debtId || isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment data");
	}

	if (source === "credit_card" && !cardDebtId) {
		throw new Error("Card is required when payment source is credit card");
	}

	const payment = await addPayment(budgetPlanId, debtId, amount, month, source, cardDebtId || undefined);
	if (!payment) throw new Error("Debt not found");
	const appliedAmount = payment.amount;

	const debt = await getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			appliedAmount
		);
		if (result) {
			await syncExpensePaymentsToPaidAmount({
				expenseId: result.expense.id,
				budgetPlanId,
				amount: result.expense.amount,
				desiredPaidAmount: result.expense.paidAmount ?? 0,
				paymentSource: mapDebtPaymentSourceToExpensePaymentSource(source),
				adjustBalances: false,
				resetOnDecrease: false,
			});

			await upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				categoryId: result.expense.categoryId,
				categoryName: debt.sourceCategoryName,
				expenseName: result.expense.name,
				remainingAmount: result.remaining,
			});
		}
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function undoDebtPaymentFromForm(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const debtId = String(formData.get("debtId") ?? "").trim();
	const paymentId = String(formData.get("paymentId") ?? "").trim();
	if (!debtId || !paymentId) throw new Error("Missing payment information");

	const debt = await getDebtById(budgetPlanId, debtId);
	if (!debt) throw new Error("Debt not found");

	const undone = await undoMostRecentPayment({ budgetPlanId, debtId, paymentId });

	// Keep expense debts in sync with their backing expense rows.
	if (debt.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const monthKey = debt.sourceMonthKey as MonthKey;
		const expense = await prisma.expense.findFirst({
			where: { id: debt.sourceExpenseId, budgetPlanId, month: monthKeyToNumber(monthKey) },
			orderBy: [{ year: "desc" }],
			select: { id: true, amount: true, paidAmount: true, year: true, categoryId: true, name: true },
		});
		if (expense) {
			const amount = Number((expense.amount as any)?.toString?.() ?? expense.amount);
			const currentPaid = Number((expense.paidAmount as any)?.toString?.() ?? expense.paidAmount);
			const nextPaidAmount = Math.max(0, Math.min(amount, currentPaid - undone.amount));
			const result = await setExpensePaymentAmount(budgetPlanId, monthKey, expense.id, nextPaidAmount, expense.year);
			if (result) {
				await syncExpensePaymentsToPaidAmount({
					expenseId: result.expense.id,
					budgetPlanId,
					amount: result.expense.amount,
					desiredPaidAmount: result.expense.paidAmount ?? 0,
					paymentSource: "extra_untracked",
					adjustBalances: false,
					resetOnDecrease: true,
				});

				await upsertExpenseDebt({
					budgetPlanId,
					expenseId: result.expense.id,
					monthKey,
					year: expense.year,
					categoryId: result.expense.categoryId,
					categoryName: debt.sourceCategoryName,
					expenseName: result.expense.name,
					remainingAmount: result.remaining,
				});
			}
		}
	}

	const debtsPath = `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/page=debts`;
	revalidatePath(debtsPath);
	revalidatePath("/admin/debts");
	revalidatePath("/dashboard");
	revalidatePath("/");
}
