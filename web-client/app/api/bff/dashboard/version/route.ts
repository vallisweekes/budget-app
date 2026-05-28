import { NextResponse, type NextRequest } from "next/server";

import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { bumpDashboardVersion, getDashboardVersion } from "@/lib/cache/dashboardCache";
import { prisma } from "@/lib/prisma";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	const { searchParams } = new URL(req.url);
	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});

	if (!budgetPlanId) {
		return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
	}

	let versionPayload = await getDashboardVersion(budgetPlanId);
	if (!versionPayload) {
		const plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { updatedAt: true },
		});
		versionPayload = await bumpDashboardVersion(budgetPlanId, plan?.updatedAt ?? new Date());
	}

	return NextResponse.json({
		budgetPlanId,
		version: versionPayload?.version ?? "0",
		changedAt: versionPayload?.changedAt ?? null,
	});
}