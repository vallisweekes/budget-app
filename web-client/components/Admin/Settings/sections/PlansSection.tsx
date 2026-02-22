"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import PlansListView from "@/components/Admin/Settings/sections/plans/PlansListView";
import PlansNewView from "@/components/Admin/Settings/sections/plans/PlansNewView";

import { getSettingsBasePath, getUserSegmentFromPath } from "@/lib/helpers/settings/navigation";
import type { BudgetPlanListItem } from "@/types/components";
import type { BudgetType } from "@/app/budgets/new/CreateBudgetForm";

export default function PlansSection({
	budgetPlanId,
	allPlans,
	createBudgetPlanAction,
}: {
	budgetPlanId: string;
	allPlans: BudgetPlanListItem[];
	createBudgetPlanAction?: (formData: FormData) => void;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const settingsBasePath = useMemo(() => getSettingsBasePath(pathname), [pathname]);
	const userSegment = useMemo(() => getUserSegmentFromPath(pathname), [pathname]);

	const planSettingsHref = useMemo(() => {
		return (planId: string) => {
			if (!userSegment) return `${settingsBasePath}/plans`;
			return `/${userSegment}/${encodeURIComponent(planId)}/page=settings/plans`;
		};
	}, [settingsBasePath, userSegment]);

	const hasPersonalPlan = useMemo(() => {
		return allPlans.some((p) => String(p.kind).toLowerCase() === "personal");
	}, [allPlans]);

	const typeParamRaw = (searchParams.get("type") ?? "").trim().toLowerCase();
	const requestedType: BudgetType =
		typeParamRaw === "holiday" || typeParamRaw === "carnival" || typeParamRaw === "personal"
			? (typeParamRaw as BudgetType)
			: "personal";

	const isPlansNewRoute = useMemo(() => {
		const parts = pathname.split("/").filter(Boolean);
		const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
		if (idx === -1) return false;
		return parts[idx + 1] === "plans" && parts[idx + 2] === "new";
	}, [pathname]);

	const defaultBudgetType: BudgetType = hasPersonalPlan
		? requestedType === "personal" && !typeParamRaw
			? "holiday"
			: requestedType
		: "personal";

	if (isPlansNewRoute) {
		return (
			<PlansNewView
				settingsBasePath={settingsBasePath}
				defaultBudgetType={defaultBudgetType}
				hasPersonalPlan={hasPersonalPlan}
				createBudgetPlanAction={createBudgetPlanAction}
				onBack={() => router.push(`${settingsBasePath}/plans`, { scroll: false })}
			/>
		);
	}

	return (
		<PlansListView
			settingsBasePath={settingsBasePath}
			allPlans={allPlans}
			budgetPlanId={budgetPlanId}
			hasPersonalPlan={hasPersonalPlan}
			planSettingsHref={planSettingsHref}
		/>
	);
}
