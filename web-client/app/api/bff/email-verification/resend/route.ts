import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";
import { sendEmailVerificationEmail } from "@/lib/auth/emailVerification";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const state = await sendEmailVerificationEmail(userId);
    return NextResponse.json({
      ok: true,
      status: state.status,
      deadlineAt: state.deadlineAt?.toISOString() ?? null,
      required: state.required,
      blocked: state.blocked,
    });
  } catch (error) {
    console.error("Failed to resend verification email:", error);
    return NextResponse.json({ error: "Could not resend verification email right now." }, { status: 500 });
  }
}