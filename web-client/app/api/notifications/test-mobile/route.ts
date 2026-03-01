import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";

type TestBody = {
	title?: string;
	body?: string;
};

type MobilePushTokenDelegate = {
	findMany: (args: unknown) => Promise<Array<{ token: string }>>;
	deleteMany: (args: { where: { token: { in: string[] } } }) => Promise<unknown>;
};

export async function POST(req: Request) {
	const userId = await getSessionUserId(req);
	if (!userId) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const mobilePushToken = (
		(prisma as unknown as Record<string, unknown>)["mobilePushToken"] as MobilePushTokenDelegate | undefined
	);
	if (!mobilePushToken) {
		return NextResponse.json({ error: "Mobile push tokens not available" }, { status: 500 });
	}

	let body: TestBody = {};
	try {
		body = (await req.json()) as TestBody;
	} catch {
		// ignore: use defaults
	}

	const records = await mobilePushToken.findMany({
		where: { userId },
		select: { token: true },
	});

	if (records.length === 0) {
		return NextResponse.json({ error: "No mobile push tokens registered for this user" }, { status: 400 });
	}

	const tokens = records.map((r) => r.token);
	const payload = {
		title: body.title ?? "Budget App",
		body: body.body ?? "Test mobile notification",
		// iOS badges require an absolute number; using 1 ensures the red dot/number appears.
		badge: 1,
	};

	const { sent, invalidTokens, errors } = await sendMobilePushNotifications(tokens, payload);

	if (invalidTokens.length > 0) {
		await mobilePushToken.deleteMany({
			where: { token: { in: invalidTokens } },
		});
	}

	return NextResponse.json({
		ok: true,
		sent,
		totalTokens: tokens.length,
		removedTokens: invalidTokens.length,
		errors,
	});
}
