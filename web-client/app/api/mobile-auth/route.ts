import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { getUserByUsername, registerUserByUsername } from "@/lib/budgetPlans";
import { normalizeUsername } from "@/lib/helpers/username";
import { createMobileAuthSession } from "@/lib/mobileAuthSessions";
import { consumeEmailLoginCode, isEmailLoginCodeRequired } from "@/lib/auth/loginCodes";
import { isRetryableConnectionError } from "@/lib/prismaRetry";

export const runtime = "nodejs";

type AuthMode = "login" | "register";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return badRequest("Invalid request body");

    const rawUsername = String(body.username ?? "");
    const username = normalizeUsername(rawUsername);
    if (!username) return badRequest("Username is required");

    const modeRaw = String(body.mode ?? "login").trim().toLowerCase();
    const mode: AuthMode = modeRaw === "register" ? "register" : "login";

    const email = String(body.email ?? "").trim().toLowerCase();

    const user =
      mode === "register"
        ? await registerUserByUsername({ username, email })
        : await getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: "User cannot be found" }, { status: 401 });
    }

    if (mode === "login" && isEmailLoginCodeRequired()) {
      const code = String(body.code ?? "").trim();
      if (!code) return NextResponse.json({ error: "Login code is required" }, { status: 400 });
      const ok = await consumeEmailLoginCode({ userId: user.id, code });
      if (!ok) return NextResponse.json({ error: "Invalid login code" }, { status: 400 });
    }

    const canonicalUsername = normalizeUsername(String(user.name ?? "")) || username;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
    }

    const maxAge = 30 * 24 * 60 * 60;
    const { sessionId } = await createMobileAuthSession({
      userId: user.id,
      maxAgeSeconds: maxAge,
    });

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

    return NextResponse.json({
      token,
      username: canonicalUsername,
      userId: user.id,
      sessionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    const normalizedMessage = message.toLowerCase();

    if (isRetryableConnectionError(error)) {
      return NextResponse.json({ error: "Database is temporarily busy. Please try again." }, { status: 503 });
    }

    if (
      message === "Email already in use"
      || message === "User already exists"
      || message === "Email is required"
      || message === "Invalid email address"
      || message === "Username is required"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Gracefully map common Prisma uniqueness failures into UX-friendly messages.
    if (normalizedMessage.includes("p2002") || normalizedMessage.includes("unique constraint")) {
      if (normalizedMessage.includes("email")) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
      if (normalizedMessage.includes("name") || normalizedMessage.includes("username")) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    if (
      message.includes("onboardingProfile")
      || message.includes("UserOnboardingProfile")
      || message.includes("P2021")
      || message.includes("does not exist")
    ) {
      return NextResponse.json({ error: "Onboarding migration is missing. Run prisma migrate deploy." }, { status: 500 });
    }

    if (normalizedMessage.includes("jwe") || normalizedMessage.includes("nextauth_secret")) {
      return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
    }

    console.error("Mobile auth failed:", error);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ error: message || "Authentication failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
