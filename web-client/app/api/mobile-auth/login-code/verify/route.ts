import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { consumeEmailLoginCode, parseLoginIdentifier, resolveUserForLoginIdentifier } from "@/lib/auth/loginCodes";
import { createMobileAuthSession } from "@/lib/mobileAuthSessions";
import { normalizeUsername } from "@/lib/helpers/username";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return badRequest("Invalid request body");

    const identifier = parseLoginIdentifier(body.identifier);
    const code = String(body.code ?? "").trim();
    if (!identifier || !code) return badRequest("Invalid code");

    const user = await resolveUserForLoginIdentifier(identifier);
    if (!user?.id) return badRequest("Invalid code");

    const ok = await consumeEmailLoginCode({ userId: user.id, code });
    if (!ok) return badRequest("Invalid code");

    const secret = String(process.env.NEXTAUTH_SECRET ?? "").trim();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Server auth is not configured" }, { status: 500 });
    }

    const canonicalUsername = normalizeUsername(String(user.username ?? "")) || "";
    const maxAge = 30 * 24 * 60 * 60;
    const { sessionId } = await createMobileAuthSession({ userId: user.id, maxAgeSeconds: maxAge });

    const token = await encode({
      token: {
        sub: user.id,
        name: canonicalUsername,
        userId: user.id,
        username: canonicalUsername,
        sid: sessionId,
      },
      secret,
      maxAge,
    });

    return NextResponse.json({ ok: true, token, userId: user.id, username: canonicalUsername, sessionId });
  } catch {
    return badRequest("Invalid code");
  }
}
