"use server";

import { revalidatePath } from "next/cache";
import type { MonthKey, PaymentStatus } from "@/types";
import { getAllExpenses, setExpensePaymentAmount } from "./store";
import { processUnpaidExpenses } from "./carryover";

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

	if (status === "paid") {
		await setExpensePaymentAmount(budgetPlanId, month, id, expense.amount);
	} else if (status === "unpaid") {
		await setExpensePaymentAmount(budgetPlanId, month, id, 0);
	} else if (status === "partial") {
		await setExpensePaymentAmount(budgetPlanId, month, id, partialAmount ?? 0);
	}

	// Auto-create debt ONLY for partial payments (immediate)
	// Unpaid expenses only become debts when the month has passed
	if (status === "partial") {
		const [year, monthNum] = month.split("-").map(Number);
		await processUnpaidExpenses({
			budgetPlanId,
			year,
			month: monthNum,
			monthKey: month,
			onlyPartialPayments: true,
		});
	}

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
}
