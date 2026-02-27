import { NextResponse } from "next/server";

import { resend, FROM_ADDRESS } from "@/lib/email/client";
import { loginCodeEmailHtml, loginCodeEmailText } from "@/lib/email/templates/loginCode";
import { issueEmailLoginCode, parseLoginIdentifier, resolveUserForLoginIdentifier } from "@/lib/auth/loginCodes";

export const runtime = "nodejs";

function ok() {
  // Avoid user enumeration: always return ok.
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const identifier = parseLoginIdentifier(body?.identifier);
    if (!identifier) return ok();

    const user = await resolveUserForLoginIdentifier(identifier);
    if (!user?.id) return ok();

    const to = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
    if (!to) return ok();

    const issued = await issueEmailLoginCode({ userId: user.id });
    if (issued.suppressedByCooldown) return ok();

    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: "Your BudgetIn Check login code",
      html: loginCodeEmailHtml({ code: issued.code }),
      text: loginCodeEmailText({ code: issued.code }),
    });

    return ok();
  } catch {
    // Don't leak details; client should treat as best-effort.
    return ok();
  }
}
