import test from "node:test";
import assert from "node:assert/strict";

import type { ExpenseItem } from "@/types/helpers/expenses";

import type { PreviousMonthRecap } from "@/lib/expenses/insights";

import { buildDashboardRecapTips } from "./buildDashboardRecapTips";

test("buildDashboardRecapTips returns a light tip for new users when recap is suppressed but current expenses exist", () => {
	const currentMonthExpenses: ExpenseItem[] = [
		{
			id: "rent",
			name: "Rent",
			amount: 920,
			paid: false,
			paidAmount: 0,
			dueDate: "2026-06-02",
		},
	];

	const tips = buildDashboardRecapTips({
		recap: null,
		shouldSuppressRecap: true,
		currentMonthExpenses,
		ctx: { year: 2026, monthNum: 6, payDate: 15, now: new Date("2026-06-03T00:00:00.000Z") },
	});

	assert.equal(tips.length, 1);
	assert.equal(tips[0]?.title, "You're on track");
	assert.match(tips[0]?.detail ?? "", /keep your reminders or autopay in place/i);
	assert.equal(tips[0]?.priority, 18);
});

test("buildDashboardRecapTips keeps tips empty when recap is suppressed and there is no current expense context", () => {
	const recap: PreviousMonthRecap | null = null;

	const tips = buildDashboardRecapTips({
		recap,
		shouldSuppressRecap: true,
		currentMonthExpenses: [],
		ctx: { year: 2026, monthNum: 6, payDate: 15, now: new Date("2026-06-03T00:00:00.000Z") },
	});

	assert.deepEqual(tips, []);
});