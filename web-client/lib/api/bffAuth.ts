import { getServerSession } from "next-auth/next";
import { decode } from "next-auth/jwt";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMobileAuthSessionActive } from "@/lib/mobileAuthSessions";

type BearerIdentity = {
	userId: string;
	sessionId: string | null;
};

async function getBearerIdentityFromAuthHeader(authHeader: string | null): Promise<BearerIdentity | null> {
	const auth = (authHeader ?? "").trim();
	const prefix = "bearer ";
	if (!auth.toLowerCase().startsWith(prefix)) return null;

	const rawToken = auth.slice(prefix.length).trim();
	if (!rawToken) return null;

	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) return null;

	const decoded = await decode({ token: rawToken, secret });
	if (!decoded || typeof decoded !== "object") return null;

	const obj = decoded as Record<string, unknown>;
	const userId = (
		typeof obj.userId === "string"
			? obj.userId
			: typeof obj.sub === "string"
				? obj.sub
				: ""
	).trim();
	if (!userId) return null;

	const sessionId = typeof obj.sid === "string" && obj.sid.trim() ? obj.sid.trim() : null;
	return { userId, sessionId };
}

export async function getSessionUserId(request?: Request): Promise<string | null> {
	// Prefer mobile Bearer auth if present. Avoids NextAuth attempting to parse
	// Authorization in getServerSession (which can throw JWT_SESSION_ERROR).
	let authHeader = request?.headers?.get?.("authorization") ?? null;
	if (!authHeader) {
		try {
			const hdrs = await headers();
			authHeader = hdrs.get("authorization");
		} catch {
			// headers() is only available in a request context.
		}
	}
	if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
		try {
			const bearer = await getBearerIdentityFromAuthHeader(authHeader);
			if (!bearer) return null;
			if (bearer.sessionId) {
				const active = await isMobileAuthSessionActive({ userId: bearer.userId, sessionId: bearer.sessionId });
				if (!active) return null;
			}
			return bearer.userId;
		} catch {
			return null;
		}
	}

	// Browser / cookie sessions
	try {
		const session = await getServerSession(authOptions);
		const sessionUser = session?.user as { id?: string; sessionId?: string } | null | undefined;
		const sessionUserId = typeof sessionUser?.id === "string" ? sessionUser.id.trim() : "";
		const sessionIdFromSession = typeof sessionUser?.sessionId === "string" ? sessionUser.sessionId.trim() : "";

		if (!sessionUserId) return null;
		if (sessionIdFromSession) {
			const active = await isMobileAuthSessionActive({ userId: sessionUserId, sessionId: sessionIdFromSession });
			if (!active) return null;
		}
		return sessionUserId;
	} catch {
		return null;
	}
}

export async function resolveOwnedBudgetPlanId(params: {
	userId: string;
	budgetPlanId: string | null;
}): Promise<string | null> {
	const budgetPlanId = params.budgetPlanId?.trim();
	if (budgetPlanId) {
		const owned = await prisma.budgetPlan.findFirst({
			where: { id: budgetPlanId, userId: params.userId },
			select: { id: true },
		});
		return owned?.id ?? null;
	}

	// Prefer a "personal" plan (matches web client's getDefaultBudgetPlanForUser logic)
	const personal = await prisma.budgetPlan.findFirst({
		where: { userId: params.userId, kind: "personal" },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});
	if (personal) return personal.id;

	// Fall back to the most recent plan of any kind
	const plan = await prisma.budgetPlan.findFirst({
		where: { userId: params.userId },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});

	return plan?.id ?? null;
}
