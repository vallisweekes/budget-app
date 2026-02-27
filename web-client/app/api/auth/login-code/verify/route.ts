import { NextResponse } from "next/server";

import { consumeEmailLoginCode, parseLoginIdentifier, resolveUserForLoginIdentifier } from "@/lib/auth/loginCodes";

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

    // This endpoint only verifies code consumption. Web sign-in wiring can
    // later be done via NextAuth CredentialsProvider.
    return NextResponse.json({ ok: true, userId: user.id, username: user.username || null });
  } catch {
    return badRequest("Invalid code");
  }
}
