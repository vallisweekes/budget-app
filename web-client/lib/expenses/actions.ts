"use server";

import { revalidatePath } from "next/cache";
import type { MonthKey, PaymentStatus } from "@/types";
import { MONTHS } from "@/lib/constants/time";
import { getAllExpenses, setExpensePaymentAmount, updateExpense } from "./store";
import { processUnpaidExpenses } from "./carryover";
import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { syncExpensePaymentsToPaidAmount } from "@/lib/expenses/paymentSync";

export async function updateExpenseDueDate(
	budgetPlanId: string,
	month: MonthKey,
	expenseId: string,
	dueDate: string | null
): Promise<void> {
	await updateExpense(budgetPlanId, month, expenseId, {
		dueDate: dueDate ?? undefined,
	});

	revalidatePath("/");
	revalidatePath("/admin/expenses");
}

export async function updatePaymentStatus(
	budgetPlanId: string,
  month: MonthKey,
  id: string,
  status: PaymentStatus,
  partialAmount?: number
): Promise<void> {
	const data = await getAllExpenses(budgetPlanId);
	const expense = data[month]?.find((e) => e.id === id);
	if (!expense) return;

	const nextPaidAmount =
		status === "paid" ? expense.amount : status === "unpaid" ? 0 : (partialAmount ?? 0);
	const updated = await setExpensePaymentAmount(budgetPlanId, month, id, nextPaidAmount);
	if (!updated) return;

	await syncExpensePaymentsToPaidAmount({
		expenseId: updated.expense.id,
		budgetPlanId,
		amount: updated.expense.amount,
		desiredPaidAmount: updated.expense.paidAmount ?? 0,
		paymentSource: "income",
		adjustBalances: false,
		resetOnDecrease: true,
	});

	if (updated.expense.isAllocation) {
		// Allocation-tagged expenses should never create/maintain debts.
		const existingDebt = await prisma.debt.findFirst({
			where: {
				budgetPlanId,
				sourceType: "expense",
				sourceExpenseId: id,
			},
			select: { sourceMonthKey: true },
		});

		if (existingDebt) {
			await upsertExpenseDebt({
				budgetPlanId,
				expenseId: updated.expense.id,
				monthKey: existingDebt.sourceMonthKey ?? month,
				expenseName: updated.expense.name,
				categoryId: updated.expense.categoryId,
				remainingAmount: 0,
			});
		}

		revalidatePath("/");
		revalidatePath("/admin/expenses");
		revalidatePath("/admin/debts");
		return;
	}

	// Auto-create debt ONLY for partial payments (immediate)
	// Unpaid expenses become debts once they are overdue enough (handled when loading Debts).
	if (status === "partial") {
		const now = new Date();
		const year = now.getFullYear();
		const monthNum = (MONTHS as MonthKey[]).indexOf(month) + 1;
		if (monthNum < 1) return;
		await processUnpaidExpenses({
			budgetPlanId,
			year,
			month: monthNum,
			monthKey: month,
			onlyPartialPayments: true,
			forceExpenseIds: [id],
		});

		revalidatePath("/");
		revalidatePath("/admin/expenses");
		revalidatePath("/admin/debts");
		return;
	}

	// If this expense already exists as a debt, keep its balance in sync.
	// This allows going back to a previous month and marking an item "Paid"
	// to immediately clear it from the Debts page.
	const existingDebt = await prisma.debt.findFirst({
		where: {
			budgetPlanId,
			sourceType: "expense",
			sourceExpenseId: id,
		},
		select: { id: true, sourceMonthKey: true },
	});

	if (existingDebt) {
		// When marking as paid, remaining amount = 0 (clears the debt)
		// When marking as unpaid, recalculate based on original expense amount
		await upsertExpenseDebt({
			budgetPlanId,
			expenseId: updated.expense.id,
			monthKey: existingDebt.sourceMonthKey ?? month,
			expenseName: updated.expense.name,
			categoryId: updated.expense.categoryId,
			remainingAmount: updated.remaining,
		});
	}

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
}
