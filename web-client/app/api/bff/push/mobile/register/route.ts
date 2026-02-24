import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

type RegisterMobilePushTokenBody = {
	token?: unknown;
	platform?: unknown;
	deviceId?: unknown;
};

export async function POST(req: NextRequest) {
	const userId = await getSessionUserId();
	if (!userId) return unauthorized();

	let body: RegisterMobilePushTokenBody;
	try {
		body = (await req.json()) as RegisterMobilePushTokenBody;
	} catch {
		return badRequest("Invalid JSON body");
	}

	const token = typeof body.token === "string" ? body.token.trim() : "";
	if (!token) return badRequest("Missing token");

	const platform = typeof body.platform === "string" ? body.platform.trim() : null;
	const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : null;

	const now = new Date();
	const mobilePushTokenDelegate = (
		(prisma as unknown as Record<string, unknown>)["mobilePushToken"] as {
			upsert: (args: unknown) => Promise<unknown>;
		}
	);
	const record = (await mobilePushTokenDelegate.upsert({
		where: { token },
		create: {
			userId,
			token,
			platform,
			deviceId,
			lastSeenAt: now,
		},
		update: {
			userId,
			platform,
			deviceId,
			lastSeenAt: now,
		},
		select: { id: true, token: true, platform: true, deviceId: true, lastSeenAt: true },
	}) as {
		id: string;
		token: string;
		platform: string | null;
		deviceId: string | null;
		lastSeenAt: Date;
	});

	return NextResponse.json({ ok: true, token: record });
}
