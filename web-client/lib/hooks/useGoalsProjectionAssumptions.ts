import { useMemo, useState } from "react";

import type { MonthlyAssumptions, MonthlyAssumptionsDraft } from "@/types";

function normalizeNowValue(raw: number): number {
	const n = Number(raw);
	return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function useGoalsProjectionAssumptions(params: {
	defaultMonthlySavings: number;
	defaultMonthlyEmergency: number;
	defaultMonthlyInvestments: number;
}): {
	assumptions: MonthlyAssumptions;
	assumptionDraft: MonthlyAssumptionsDraft;
	setAssumption: (field: keyof MonthlyAssumptionsDraft, raw: string) => void;
	clearAssumptionZeroOnFocus: (field: keyof MonthlyAssumptionsDraft) => void;
	normalizeAssumptionOnBlur: (field: keyof MonthlyAssumptionsDraft) => void;
	resetProjectionAssumptionsToNow: () => void;
	canResetProjectionAssumptions: boolean;
} {
	const { defaultMonthlySavings, defaultMonthlyEmergency, defaultMonthlyInvestments } = params;

	const savingsAssumptionNow = useMemo(() => normalizeNowValue(defaultMonthlySavings), [defaultMonthlySavings]);
	const emergencyAssumptionNow = useMemo(() => normalizeNowValue(defaultMonthlyEmergency), [defaultMonthlyEmergency]);
	const investmentsAssumptionNow = useMemo(() => normalizeNowValue(defaultMonthlyInvestments), [defaultMonthlyInvestments]);

	const [assumptions, setAssumptions] = useState<MonthlyAssumptions>({
		savings: savingsAssumptionNow,
		emergency: emergencyAssumptionNow,
		investments: investmentsAssumptionNow,
	});

	const [assumptionDraft, setAssumptionDraft] = useState<MonthlyAssumptionsDraft>({
		savings: String(savingsAssumptionNow),
		emergency: String(emergencyAssumptionNow),
		investments: String(investmentsAssumptionNow),
	});

	const clearAssumptionZeroOnFocus = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraft((prev) => {
			if (prev[field] !== "0") return prev;
			return { ...prev, [field]: "" };
		});
	};

	const normalizeAssumptionOnBlur = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraft((prev) => {
			if (prev[field].trim() !== "") return prev;
			return { ...prev, [field]: "0" };
		});
	};

	const setAssumption = (field: keyof MonthlyAssumptionsDraft, raw: string) => {
		setAssumptionDraft((prev) => ({ ...prev, [field]: raw }));
		const next = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
		const value = Number.isFinite(next) ? Math.max(0, next) : 0;
		setAssumptions((prev) => ({ ...prev, [field]: value } as MonthlyAssumptions));
	};

	const resetProjectionAssumptionsToNow = () => {
		setAssumptions({
			savings: savingsAssumptionNow,
			emergency: emergencyAssumptionNow,
			investments: investmentsAssumptionNow,
		});
		setAssumptionDraft({
			savings: String(savingsAssumptionNow),
			emergency: String(emergencyAssumptionNow),
			investments: String(investmentsAssumptionNow),
		});
	};

	const canResetProjectionAssumptions =
		assumptions.savings !== savingsAssumptionNow ||
		assumptions.emergency !== emergencyAssumptionNow ||
		assumptions.investments !== investmentsAssumptionNow;

	return {
		assumptions,
		assumptionDraft,
		setAssumption,
		clearAssumptionZeroOnFocus,
		normalizeAssumptionOnBlur,
		resetProjectionAssumptionsToNow,
		canResetProjectionAssumptions,
	};
}
