import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revokeMobileAuthSession } from "@/lib/mobileAuthSessions";

export const runtime = "nodejs";
import { decode } from "next-auth/jwt";

export async function POST(request: Request) {
  try {
    // Prefer Bearer token auth (mobile clients). Avoids getServerSession parsing issues.
    const auth = request.headers.get("authorization") ?? "";
    const prefix = "bearer ";
    if (auth.toLowerCase().startsWith(prefix)) {
      const rawToken = auth.slice(prefix.length).trim();
      const secret = process.env.NEXTAUTH_SECRET;
      if (rawToken && secret) {
        const decoded = await decode({ token: rawToken, secret });
        if (decoded && typeof decoded === "object") {
          const obj = decoded as Record<string, unknown>;
          const resolvedUserId = (
            typeof obj.userId === "string"
              ? obj.userId
              : typeof obj.sub === "string"
                ? obj.sub
                : ""
          ).trim();
          const resolvedSessionId = typeof obj.sid === "string" ? obj.sid.trim() : "";
          if (resolvedUserId && resolvedSessionId) {
            await revokeMobileAuthSession({ userId: resolvedUserId, sessionId: resolvedSessionId });
            return NextResponse.json({ ok: true });
          }
        }
      }
    }

    let resolvedUserId = "";
    let resolvedSessionId = "";

    try {
      const session = await getServerSession(authOptions);
      const user = session?.user as { id?: string; sessionId?: string } | null | undefined;
      resolvedUserId = typeof user?.id === "string" ? user.id.trim() : "";
      resolvedSessionId = typeof user?.sessionId === "string" ? user.sessionId.trim() : "";
    } catch {
      // ignore
    }

    if (resolvedUserId && resolvedSessionId) {
      await revokeMobileAuthSession({ userId: resolvedUserId, sessionId: resolvedSessionId });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
