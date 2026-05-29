import test from "node:test";
import assert from "node:assert/strict";

import type { ExpenseItem } from "@/types/helpers/expenses";

import { computeRecapTips, type PreviousMonthRecap } from "./insights";

test("computeRecapTips returns a lighter guidance tip when the user is on track", () => {
	const recap: PreviousMonthRecap = {
		label: "Apr 2026",
		totalCount: 4,
		totalAmount: 920,
		paidCount: 4,
		paidAmount: 920,
		partialCount: 0,
		partialAmount: 0,
		unpaidCount: 0,
		unpaidAmount: 0,
		missedDueCount: 0,
		missedDueAmount: 0,
	};

	const currentMonthExpenses: ExpenseItem[] = [
		{
			id: "rent",
			name: "Rent",
			amount: 920,
			paid: true,
			paidAmount: 920,
			dueDate: "2026-05-02",
		},
	];

	const tips = computeRecapTips({
		recap,
		currentMonthExpenses,
		ctx: { year: 2026, monthNum: 5, payDate: 15, now: new Date("2026-05-20T00:00:00.000Z") },
	});

	assert.equal(tips.length, 1);
	assert.equal(tips[0]?.title, "You're on track");
	assert.match(tips[0]?.detail ?? "", /Last period's bills were covered/i);
	assert.equal(tips[0]?.priority, 18);
});