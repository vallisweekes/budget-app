import test from "node:test";
import assert from "node:assert/strict";

import { getOnboardingStarterTips } from "./onboardingStarterTips";

test("getOnboardingStarterTips keeps the generic starter when no income or bills exist", () => {
	const tips = getOnboardingStarterTips({
		budgetSnapshot: {
			totalIncome: 0,
			totalExpenses: 0,
			plannedExpenseCount: 0,
		},
	});

	assert.equal(tips[0]?.title, "Start simple");
	assert.match(tips[0]?.detail ?? "", /add income, add your main bills/i);
});

test("getOnboardingStarterTips does not ask for income when dashboard totals already include it", () => {
	const tips = getOnboardingStarterTips({
		budgetSnapshot: {
			totalIncome: 3200,
			totalExpenses: 0,
			plannedExpenseCount: 0,
		},
	});

	assert.equal(tips[0]?.title, "Add your main bills");
	assert.doesNotMatch(tips[0]?.detail ?? "", /add income/i);
});

test("getOnboardingStarterTips switches to spending guidance when income and bills already exist", () => {
	const tips = getOnboardingStarterTips({
		budgetSnapshot: {
			totalIncome: 3200,
			totalExpenses: 1450,
			plannedExpenseCount: 3,
		},
	});

	assert.equal(tips[0]?.title, "Track spending for a week");
	assert.match(tips[0]?.detail ?? "", /income and main bills are already set/i);
});