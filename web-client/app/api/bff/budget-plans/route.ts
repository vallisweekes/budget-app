import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
	getOrCreateBudgetPlanForUser,
	isSupportedBudgetType,
	listBudgetPlansForUser,
	resolveUserId,
	type SupportedBudgetType,
} from "@/lib/budgetPlans";

export async function GET() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });
	const plans = await listBudgetPlansForUser({ userId, username });

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
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	const rawKind = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "personal";
	if (!isSupportedBudgetType(rawKind)) {
		return NextResponse.json({ error: "Invalid budget kind" }, { status: 400 });
	}

	const planName = typeof body?.name === "string" ? body.name.trim() : undefined;
	const includePostEventIncome = Boolean(body?.includePostEventIncome);
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
		const userId = await resolveUserId({ userId: sessionUser.id, username });
		const plan = await getOrCreateBudgetPlanForUser({
			userId,
			username,
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
