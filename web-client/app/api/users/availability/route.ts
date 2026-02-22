import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, "-");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("username") ?? "";
  const username = normalizeUsername(raw);

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { name: username },
    select: { id: true },
  });

  return NextResponse.json({
    username,
    available: !existing,
  });
}
