"use server";

import { revalidatePath } from "next/cache";
import { getDebtById, updateDebt } from "./store";
import type { PaymentStatus } from "@/types";

export async function updateDebtPaymentStatus(
	budgetPlanId: string,
  month: string,
  id: string,
  status: PaymentStatus,
  partialAmount?: number
): Promise<void> {
	const debt = await getDebtById(budgetPlanId, id);
	if (!debt) return;

	if (status === "paid") {
		await updateDebt(budgetPlanId, id, {
			paid: true,
			paidAmount: debt.initialBalance,
			currentBalance: 0,
		});
	} else if (status === "unpaid") {
		await updateDebt(budgetPlanId, id, {
			paid: false,
			paidAmount: 0,
			currentBalance: debt.initialBalance,
		});
	} else if (status === "partial") {
		const paidAmount = Math.max(0, partialAmount ?? 0);
		await updateDebt(budgetPlanId, id, {
			paid: false,
			paidAmount,
			currentBalance: Math.max(0, debt.initialBalance - paidAmount),
		});
	}

  revalidatePath("/");
  revalidatePath("/admin/debts");
}
