import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listBudgetPlansForUser, resolveUserId } from "@/lib/budgetPlans";

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
			createdAt: p.createdAt,
		})),
	});
}
