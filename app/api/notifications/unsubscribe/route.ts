import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";

type UnsubscribeBody = {
	endpoint?: string;
};

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });

	let body: UnsubscribeBody;
	try {
		body = (await req.json()) as UnsubscribeBody;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (!body.endpoint) {
		return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
	}

	const webPushSubscription = (prisma as any)?.webPushSubscription ?? null;
	if (!webPushSubscription) {
		return NextResponse.json({ error: "Push subscriptions not available" }, { status: 500 });
	}

	await webPushSubscription.deleteMany({
		where: {
			userId,
			endpoint: body.endpoint,
		},
	});

	return NextResponse.json({ ok: true });
}
