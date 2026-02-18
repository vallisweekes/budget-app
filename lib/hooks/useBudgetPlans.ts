"use client";

import { useEffect, useState } from "react";
import type { BudgetPlan } from "@/types";

export function useBudgetPlans(params?: { budgetPlanId?: string }): BudgetPlan[] {
	const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);

	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const res = await fetch("/api/bff/budget-plans", { cache: "no-store" });
				if (!res.ok) return;
				const data = (await res.json()) as { plans?: BudgetPlan[] };
				if (!Array.isArray(data.plans)) return;

				const normalizedPlans = data.plans.map((p) => {
					const rawPayDate = (p as unknown as { payDate?: unknown }).payDate;
					const parsedPayDate = typeof rawPayDate === "number" ? rawPayDate : Number(rawPayDate);
					const rawHorizon = (p as unknown as { budgetHorizonYears?: unknown }).budgetHorizonYears;
					const parsedHorizon = typeof rawHorizon === "number" ? rawHorizon : Number(rawHorizon);
					return {
						...p,
						payDate: Number.isFinite(parsedPayDate) && parsedPayDate > 0 ? parsedPayDate : 27,
						budgetHorizonYears: Number.isFinite(parsedHorizon) && parsedHorizon > 0 ? parsedHorizon : undefined,
					};
				});

				if (isMounted) setBudgetPlans(normalizedPlans);
			} catch {
				// Non-blocking
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [params?.budgetPlanId]);

	return budgetPlans;
}
