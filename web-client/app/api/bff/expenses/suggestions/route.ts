import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toOptionalString(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

/**
 * GET /api/bff/expenses/suggestions?budgetPlanId=...&categoryId=...
 *
 * Returns recent unique expenses (deduped by seriesKey) for the given category.
 * This is used by clients to offer a dropdown and reduce accidental duplicates / mismatches.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const categoryIdRaw = searchParams.get("categoryId");
  const categoryId = typeof categoryIdRaw === "string" ? categoryIdRaw.trim() : "";
  if (!categoryId) return badRequest("categoryId is required");

  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId: searchParams.get("budgetPlanId"),
  });
  if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

  // Pull a bounded, recent-ish set then dedupe in-memory.
  const rows = await prisma.expense.findMany({
    where: {
      budgetPlanId,
      categoryId,
      isAllocation: false,
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    take: 250,
    select: {
      id: true,
      name: true,
      amount: true,
      merchantDomain: true,
      seriesKey: true,
      month: true,
      year: true,
    },
  });

  const seen = new Set<string>();
  const out: Array<{
    seriesKey: string;
    name: string;
    amount: string;
    merchantDomain: string | null;
    lastSeenMonth: number;
    lastSeenYear: number;
  }> = [];

  for (const r of rows) {
    const key = toOptionalString(r.seriesKey) ?? null;
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      seriesKey: key,
      name: String(r.name ?? "").trim(),
      amount: String((r.amount as any)?.toString?.() ?? r.amount ?? "0"),
      merchantDomain: toOptionalString(r.merchantDomain),
      lastSeenMonth: Number(r.month) || 0,
      lastSeenYear: Number(r.year) || 0,
    });

    if (out.length >= 20) break;
  }

  return NextResponse.json(out);
}
