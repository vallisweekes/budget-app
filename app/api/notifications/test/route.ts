import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { sendWebPushNotification } from "@/lib/push/webPush";

type TestBody = {
	title?: string;
	body?: string;
	url?: string;
};

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });

	const webPushSubscription = (prisma as any)?.webPushSubscription ?? null;
	if (!webPushSubscription) {
		return NextResponse.json({ error: "Push subscriptions not available" }, { status: 500 });
	}

	let body: TestBody = {};
	try {
		body = (await req.json()) as TestBody;
	} catch {
		// ignore: defaults
	}

	const subscriptions = await webPushSubscription.findMany({
		where: { userId },
		select: { endpoint: true, p256dh: true, auth: true },
	});

	if (subscriptions.length === 0) {
		return NextResponse.json({ error: "No subscriptions" }, { status: 400 });
	}

	const payload = {
		title: body.title ?? "Budget App",
		body: body.body ?? "Test notification",
		url: body.url ?? "/dashboard",
	};

	let sent = 0;
	let removed = 0;
	const errors: Array<{ endpoint: string; error: string }> = [];

	for (const sub of subscriptions) {
		try {
			await sendWebPushNotification({ subscription: sub, payload });
			sent += 1;
		} catch (err: any) {
			const statusCode = err?.statusCode as number | undefined;
			if (statusCode === 404 || statusCode === 410) {
				await webPushSubscription.deleteMany({
					where: { userId, endpoint: sub.endpoint },
				});
				removed += 1;
				continue;
			}

			errors.push({
				endpoint: sub.endpoint,
				error: String(err?.message ?? err),
			});
		}
	}

	return NextResponse.json({ ok: true, sent, removed, errors });
}
