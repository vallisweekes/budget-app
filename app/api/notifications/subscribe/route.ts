import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";

type PushSubscriptionJSON = {
	endpoint: string;
	expirationTime?: number | null;
	keys: {
		p256dh: string;
		auth: string;
	};
};

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const subscription = (body as any)?.subscription as PushSubscriptionJSON | undefined;
	const userAgent = (body as any)?.userAgent as string | undefined;

	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
	}

	const webPushSubscription = (prisma as any)?.webPushSubscription ?? null;
	if (!webPushSubscription) {
		return NextResponse.json({ error: "Push subscriptions not available" }, { status: 500 });
	}

	await webPushSubscription.upsert({
		where: { endpoint: subscription.endpoint },
		update: {
			userId,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
			userAgent,
		},
		create: {
			userId,
			endpoint: subscription.endpoint,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
			userAgent,
		},
	});

	return NextResponse.json({ ok: true });
}
