import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api/bffAuth";
import {
	getOrCreateBudgetPlanForUser,
	isSupportedBudgetType,
	listBudgetPlansForUser,
	type SupportedBudgetType,
} from "@/lib/budgetPlans";

function toBool(value: unknown): boolean {
	if (value === true) return true;
	if (value === false || value == null) return false;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (!v) return false;
		if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
		if (v === "false" || v === "0" || v === "no" || v === "off") return false;
	}
	return false;
}

export async function GET(request: Request) {
	const userId = await getSessionUserId(request);
	if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

	const plans = await listBudgetPlansForUser({ userId });

	return NextResponse.json({
		plans: plans.map((p) => ({
			id: p.id,
			name: p.name,
			kind: p.kind,
			payDate: p.payDate,
			budgetHorizonYears: p.budgetHorizonYears,
			createdAt: p.createdAt,
		})),
	});
}

export async function POST(req: Request) {
	const userId = await getSessionUserId(req);
	if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

	const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	const rawKind = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "personal";
	if (!isSupportedBudgetType(rawKind)) {
		return NextResponse.json({ error: "Invalid budget kind" }, { status: 400 });
	}

	const planName = typeof body?.name === "string" ? body.name.trim() : undefined;
	const includePostEventIncome = toBool(body?.includePostEventIncome);
	let eventDate: Date | null = null;
	if (typeof body?.eventDate === "string" && body.eventDate.trim()) {
		const parsed = new Date(body.eventDate);
		if (!Number.isNaN(parsed.getTime())) {
			eventDate = parsed;
		}
	}

	if (rawKind !== "personal" && !eventDate) {
		return NextResponse.json({ error: "eventDate is required for non-personal plans" }, { status: 400 });
	}

	try {
		const plan = await getOrCreateBudgetPlanForUser({
			userId,
			budgetType: rawKind as SupportedBudgetType,
			planName,
			eventDate,
			includePostEventIncome,
		});

		return NextResponse.json({
			id: plan.id,
			name: plan.name,
			kind: plan.kind,
			payDate: plan.payDate,
			budgetHorizonYears: plan.budgetHorizonYears,
			createdAt: plan.createdAt,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to create budget plan";
		const status = message === "Personal budget required" || message === "Event date required" ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
