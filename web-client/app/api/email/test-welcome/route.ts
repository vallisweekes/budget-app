import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_ADDRESS } from "@/lib/email/client";
import {
  welcomeEmailHtml,
  welcomeEmailText,
} from "@/lib/email/templates/welcome";

/**
 * POST /api/email/test-welcome
 *
 * Sends a test "Welcome to BudgetIn" email.
 *
 * Body (optional JSON):
 *   { "to": "someone@example.com", "name": "Vallis" }
 *
 * Defaults to vallis.weekes@gmail.com if no `to` is provided.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const to: string = body.to ?? "vallis.weekes@gmail.com";
    const name: string | undefined = body.name;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: "Welcome to BudgetIn 💸",
      html: welcomeEmailHtml({ name }),
      text: welcomeEmailText({ name }),
    });

    if (error) {
      console.error("[email/test-welcome] Resend error:", error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    console.log("[email/test-welcome] Sent to", to, "id:", data?.id);
    return NextResponse.json({ success: true, id: data?.id, to });
  } catch (err) {
    console.error("[email/test-welcome] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
