import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
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
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username });

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
	};

	const { sent, invalidTokens } = await sendMobilePushNotifications(tokens, payload);

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
	});
}
