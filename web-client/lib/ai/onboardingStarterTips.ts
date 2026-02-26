import { prioritizeRecapTips, type RecapTip } from "@/lib/expenses/insights";

type OnboardingContext = {
	mainGoal?: string | null;
	mainGoals?: string[];
	occupation?: string | null;
	monthlySalary?: number | null;
	expenseOne?: { name: string | null; amount: number | null };
	expenseTwo?: { name: string | null; amount: number | null };
	hasAllowance?: boolean | null;
	allowanceAmount?: number | null;
	hasDebtsToManage?: boolean | null;
	debtAmount?: number | null;
	debtNotes?: string | null;
};

function normalizeGoals(onboarding: OnboardingContext | null | undefined): string[] {
	const goals = Array.isArray(onboarding?.mainGoals) ? onboarding!.mainGoals! : [];
	if (goals.length) return goals;
	return onboarding?.mainGoal ? [onboarding.mainGoal] : [];
}

function hasGoal(goals: string[], goal: string): boolean {
	return goals.includes(goal);
}

export function getOnboardingStarterTips(args: {
	onboarding?: OnboardingContext | null;
	payDate?: number | null;
	maxTips?: number;
}): RecapTip[] {
	const maxTips = Math.max(1, Math.min(6, args.maxTips ?? 4));
	const onboarding = args.onboarding ?? null;
	const goals = normalizeGoals(onboarding);

	const tips: RecapTip[] = [];

	if (args.payDate == null) {
		tips.push({
			title: "Set your payday",
			detail: "Add your payday in Settings so we can time your plan and reminders.",
			priority: 82,
		});
	}

	if (hasGoal(goals, "manage_debts") || onboarding?.hasDebtsToManage) {
		const amount = Number(onboarding?.debtAmount ?? 0);
		tips.push({
			title: "Start with the minimums",
			detail: amount > 0
				? `Plan your monthly debt minimums first (about ${Math.round(amount)} total), then budget what’s left.`
				: "Plan your monthly debt minimums first, then budget what’s left.",
			priority: 92,
		});
	}

	if (hasGoal(goals, "improve_savings")) {
		tips.push({
			title: "Save something small",
			detail: "Even 10–20 a week adds up. Set a small savings pot first, then adjust as you go.",
			priority: 70,
		});
	}

	if (hasGoal(goals, "track_spending")) {
		tips.push({
			title: "Add your first few spends",
			detail: "Log your next 3–5 purchases to see where your money really goes.",
			priority: 60,
		});
	}

	if (hasGoal(goals, "build_budget")) {
		tips.push({
			title: "Lock in the basics",
			detail: "Start with rent, utilities, and transport. Once the basics are covered, split what’s left across goals.",
			priority: 65,
		});
	}

	const billNames = [onboarding?.expenseOne?.name, onboarding?.expenseTwo?.name]
		.map((n) => (typeof n === "string" ? n.trim() : ""))
		.filter(Boolean);
	if (billNames.length) {
		tips.push({
			title: "Check your monthly bills",
			detail: `Make sure ${billNames.slice(0, 2).join(" and ")} are in your plan with the right amounts.`,
			priority: 75,
		});
	}

	// If we still have nothing (e.g. skipped onboarding), show a simple starter.
	if (!tips.length) {
		tips.push({
			title: "Start simple",
			detail: "Add income, add your main bills, then track spending for a week to tighten things up.",
			priority: 60,
		});
	}

	return prioritizeRecapTips(tips, maxTips);
}
