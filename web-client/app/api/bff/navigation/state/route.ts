import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

const navStateSelect = {
	navStateJson: true,
	navStateUpdatedAt: true,
} as const;

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * GET /api/bff/navigation/state
 * Returns: { stateJson: string|null, updatedAt: string|null }
 */
export async function GET(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	const user = await prisma.user.findFirst({
		where: { id: userId },
		select: navStateSelect as unknown as NonNullable<Parameters<typeof prisma.user.findFirst>[0]>["select"],
	});

	const typedUser = user as unknown as {
		navStateJson?: string | null;
		navStateUpdatedAt?: Date | null;
	};

	return NextResponse.json({
		stateJson: typedUser?.navStateJson ?? null,
		updatedAt: typedUser?.navStateUpdatedAt ? typedUser.navStateUpdatedAt.toISOString() : null,
	});
}

/**
 * PUT /api/bff/navigation/state
 * Body: { stateJson: string|null }
 * Returns: { ok: true }
 */
export async function PUT(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	let body: { stateJson?: unknown };
	try {
		body = (await req.json()) as { stateJson?: unknown };
	} catch {
		return badRequest("Invalid JSON body");
	}

	const stateJsonRaw = body?.stateJson;
	const stateJson =
		stateJsonRaw === null
			? null
			: typeof stateJsonRaw === "string"
				? stateJsonRaw
				: null;

	// Basic guardrails: avoid storing empty strings.
	const finalJson = stateJson && stateJson.trim() ? stateJson : null;

	await prisma.user.update({
		where: { id: userId },
		data: {
			navStateJson: finalJson,
			navStateUpdatedAt: finalJson ? new Date() : null,
		} as unknown as NonNullable<Parameters<typeof prisma.user.update>[0]>["data"],
	});

	return NextResponse.json({ ok: true });
}
