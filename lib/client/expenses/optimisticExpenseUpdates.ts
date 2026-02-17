import type { ExpenseItem } from "@/types";

function isTruthyAll(values: unknown[]): boolean {
	return values.some((v) => String(v).trim().toLowerCase() === "true");
}

export function optimisticTogglePaid(args: {
	expenses: ExpenseItem[];
	expenseId: string;
}): { next: ExpenseItem[]; prevSnapshot: ExpenseItem | null } {
	const { expenses, expenseId } = args;
	const prevExpense = expenses.find((e) => e.id === expenseId);
	if (!prevExpense) return { next: expenses, prevSnapshot: null };
	const prevSnapshot = { ...prevExpense };
	const nextPaid = !prevExpense.paid;
	const nextPaidAmount = nextPaid ? prevExpense.amount : 0;

	return {
		next: expenses.map((e) => (e.id === expenseId ? { ...e, paid: nextPaid, paidAmount: nextPaidAmount } : e)),
		prevSnapshot,
	};
}

export function optimisticApplyPayment(args: {
	expenses: ExpenseItem[];
	expenseId: string;
	paymentAmount: number;
}): { next: ExpenseItem[]; prevSnapshot: ExpenseItem | null } {
	const { expenses, expenseId, paymentAmount } = args;
	const prevExpense = expenses.find((e) => e.id === expenseId);
	if (!prevExpense) return { next: expenses, prevSnapshot: null };
	const prevSnapshot = { ...prevExpense };

	const nextPaidAmount = Math.min(prevExpense.amount, (prevExpense.paidAmount ?? 0) + paymentAmount);
	const nextPaid = nextPaidAmount >= prevExpense.amount && prevExpense.amount > 0;

	return {
		next: expenses.map((e) => (e.id === expenseId ? { ...e, paidAmount: nextPaidAmount, paid: nextPaid } : e)),
		prevSnapshot,
	};
}

export function optimisticEditExpense(args: {
	expenses: ExpenseItem[];
	data: FormData;
}): {
	next: ExpenseItem[];
	prevSnapshot: ExpenseItem | null;
	editingId: string;
} {
	const { expenses, data } = args;
	const editingId = String(data.get("id") ?? "");
	const prevExpense = expenses.find((ex) => ex.id === editingId);
	if (!prevExpense) return { next: expenses, prevSnapshot: null, editingId };
	const prevSnapshot = { ...prevExpense };

	const name = String(data.get("name") ?? prevExpense.name).trim();
	const amount = Number(data.get("amount") ?? prevExpense.amount);
	const rawCategoryId = String(data.get("categoryId") ?? "").trim();
	const categoryId = rawCategoryId ? rawCategoryId : undefined;
	const dueDateRaw = String(data.get("dueDate") ?? "").trim();
	const dueDate = dueDateRaw ? dueDateRaw : undefined;
	const isAllocation = isTruthyAll(data.getAll("isAllocation") as any[]);

	const nextAmount = Number.isFinite(amount) ? amount : prevExpense.amount;
	let nextPaidAmount = prevExpense.paidAmount;
	if (prevExpense.paid) nextPaidAmount = nextAmount;
	else nextPaidAmount = Math.min(prevExpense.paidAmount ?? 0, nextAmount);

	const nextPaid = nextPaidAmount >= nextAmount && nextAmount > 0;
	if (nextPaid) nextPaidAmount = nextAmount;

	return {
		editingId,
		prevSnapshot,
		next: expenses.map((ex) =>
			ex.id === editingId
				? {
					...ex,
					name: name || ex.name,
					amount: nextAmount,
					categoryId,
					dueDate,
					isAllocation,
					paidAmount: nextPaidAmount,
					paid: nextPaid,
				}
				: ex
		),
	};
}
