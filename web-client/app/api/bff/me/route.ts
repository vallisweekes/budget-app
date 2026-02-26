import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      id: user.id,
      username: String(user.name ?? "").trim(),
      email: user.email,
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!("email" in body)) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const rawEmail = body.email;
    const normalized = rawEmail == null ? "" : normalizeEmail(String(rawEmail));
    if (normalized && !isValidEmail(normalized)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalized || null,
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({
      id: updated.id,
      username: String(updated.name ?? "").trim(),
      email: updated.email,
    });
  } catch (error) {
    const message = String((error as { message?: unknown })?.message ?? "");
    if (message.includes("Unique constraint") || message.includes("P2002")) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
