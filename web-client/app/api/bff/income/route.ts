import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});

		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const where: any = { budgetPlanId };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const income = await prisma.income.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = await request.json();
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: typeof body?.budgetPlanId === "string" ? body.budgetPlanId : null,
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const name: string = String(body.name ?? "").trim();
    const amount = Number(body.amount);
    const month = Number(body.month);
    const year = Number(body.year);
    const distributeMonths = Boolean(body.distributeMonths ?? false);
    const distributeYears = Boolean(body.distributeYears ?? false);

    const targetYears = distributeYears ? [year, year + 1] : [year];

    let firstCreated: any = null;
    for (const y of targetYears) {
      const startMonth = y === year ? month : (distributeMonths ? 1 : month);
      const endMonth = distributeMonths ? 12 : month;
      for (let m = startMonth; m <= endMonth; m++) {
        // Upsert so we don't create duplicates on re-run
        const existing = await prisma.income.findFirst({
          where: { budgetPlanId, month: m, year: y, name },
        });
        if (existing) {
          if (!firstCreated) firstCreated = existing;
          continue;
        }
        const record = await prisma.income.create({
          data: { name, amount, month: m, year: y, budgetPlanId },
        });
        if (!firstCreated) firstCreated = record;
      }
    }

    return NextResponse.json(firstCreated, { status: 201 });
  } catch (error) {
    console.error("Failed to create income:", error);
    return NextResponse.json(
      { error: "Failed to create income" },
      { status: 500 }
    );
  }
}
