import type { GoalLike, MonthlyAssumptions } from "@/types";

export type GoalsProjectionPoint = {
	t: number;
	savings: number;
	emergency: number;
	investments: number;
	total: number;
};

export type GoalsProjection = {
	startingSavings: number;
	startingEmergency: number;
	startingInvestments: number;
	monthlySavings: number;
	monthlyEmergency: number;
	monthlyInvestments: number;
	points: GoalsProjectionPoint[];
};

function sumCategory(goals: GoalLike[], category: GoalLike["category"]): number {
	return goals
		.filter((g) => g.category === category)
		.reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);
}

export function calculateGoalsProjection(params: {
	goals: GoalLike[];
	assumptions: MonthlyAssumptions;
	projectionHorizonYears: number;
}): GoalsProjection {
	const { goals, assumptions, projectionHorizonYears } = params;

	const monthlySavings = Math.max(0, assumptions.savings);
	const monthlyEmergency = Math.max(0, assumptions.emergency);
	const monthlyInvestments = Math.max(0, assumptions.investments);

	const startingSavings = sumCategory(goals, "savings");
	const startingEmergency = sumCategory(goals, "emergency");
	const startingInvestments = sumCategory(goals, "investment");

	const monthsToProject = Math.max(1, Math.min(12 * projectionHorizonYears, 12 * 30));
	let savings = startingSavings;
	let emergency = startingEmergency;
	let investments = startingInvestments;

	const points: GoalsProjectionPoint[] = [{ t: 0, savings, emergency, investments, total: savings + emergency + investments }];

	for (let i = 1; i <= monthsToProject; i += 1) {
		savings += monthlySavings;
		emergency += monthlyEmergency;
		investments += monthlyInvestments;
		points.push({ t: i, savings, emergency, investments, total: savings + emergency + investments });
	}

	return {
		startingSavings,
		startingEmergency,
		startingInvestments,
		monthlySavings,
		monthlyEmergency,
		monthlyInvestments,
		points,
	};
}
