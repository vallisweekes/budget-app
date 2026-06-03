import { NextResponse, type NextRequest } from "next/server";

import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SavingsPotField = "savings" | "emergency" | "investment";

type SavingsPotPayload = {
  id: string;
  field: SavingsPotField;
  name: string;
  amount: number;
  broker: string;
  allocationId?: string;
};

type SavingsPotRow = {
  id: string;
  field: SavingsPotField;
  name: string;
  amount: unknown;
  broker?: unknown;
  allocationId?: string | null;
};

type SavingsPotDelegate = {
  findMany?: (args: unknown) => Promise<SavingsPotRow[]>;
  deleteMany?: (args: unknown) => Promise<unknown>;
  createMany?: (args: unknown) => Promise<unknown>;
};

type PrismaWithSavingsPot = {
  savingsPot?: SavingsPotDelegate;
};

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeBroker(value: unknown): string {
  if (typeof value !== "string") return "none";
  const normalized = value.trim();
  return normalized || "none";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    const withToString = value as { toString?: () => string };
    if (typeof withToString.toString === "function") {
      const parsed = Number(withToString.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toResponsePot(row: SavingsPotRow): SavingsPotPayload {
  return {
    id: row.id,
    field: row.field,
    name: row.name,
    amount: Math.max(0, toNumber(row.amount)),
    broker: normalizeBroker(row.broker),
    ...(typeof row.allocationId === "string" && row.allocationId.trim() ? { allocationId: row.allocationId.trim() } : {}),
  };
}

function normalizeInputPot(raw: unknown, index: number): SavingsPotPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;

  const field = rec.field;
  if (field !== "savings" && field !== "emergency" && field !== "investment") {
    return null;
  }

  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!name) return null;

  const amount = toNumber(rec.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const id = typeof rec.id === "string" && rec.id.trim()
    ? rec.id.trim()
    : `pot-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;

  const allocationId = typeof rec.allocationId === "string" && rec.allocationId.trim()
    ? rec.allocationId.trim()
    : undefined;

  return {
    id,
    field,
    name,
    amount,
    broker: normalizeBroker(rec.broker),
    ...(allocationId ? { allocationId } : {}),
  };
}

async function requireOwnedPlanId(request: NextRequest, userId: string, bodyBudgetPlanId?: unknown): Promise<string | null> {
  const queryPlanId = new URL(request.url).searchParams.get("budgetPlanId");
  return resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId: typeof bodyBudgetPlanId === "string" ? bodyBudgetPlanId : queryPlanId,
  });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const budgetPlanId = await requireOwnedPlanId(request, userId);
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const savingsPotDelegate = (prisma as unknown as PrismaWithSavingsPot).savingsPot;
    if (!savingsPotDelegate?.findMany) {
      return NextResponse.json({ pots: [] });
    }

    const rows = (await savingsPotDelegate.findMany({
      where: { budgetPlanId },
      orderBy: [{ field: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        field: true,
        name: true,
        amount: true,
        broker: true,
        allocationId: true,
      },
    })) as SavingsPotRow[];

    return NextResponse.json({ pots: rows.map(toResponsePot) });
  } catch (error) {
    console.error("[bff/savings-pots] GET error", error);
    return NextResponse.json({ error: "Failed to fetch savings pots" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return badRequest("Invalid JSON body");
    }

    const budgetPlanId = await requireOwnedPlanId(request, userId, body.budgetPlanId);
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const inputPots = Array.isArray(body.pots) ? body.pots : [];
    const normalized: SavingsPotPayload[] = [];
    for (let i = 0; i < inputPots.length; i += 1) {
      const pot = normalizeInputPot(inputPots[i], i);
      if (!pot) {
        return badRequest(`Invalid savings pot at index ${i}`);
      }
      normalized.push(pot);
    }

    const uniqueIds = new Set<string>();
    for (const pot of normalized) {
      if (uniqueIds.has(pot.id)) {
        return badRequest("Savings pot ids must be unique");
      }
      uniqueIds.add(pot.id);
    }

    const savingsPotDelegate = (prisma as unknown as PrismaWithSavingsPot).savingsPot;
    if (!savingsPotDelegate?.deleteMany || !savingsPotDelegate?.createMany || !savingsPotDelegate?.findMany) {
      return NextResponse.json(
        { error: "Savings pots are not available yet. Restart the dev server after running Prisma migrations." },
        { status: 503 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const txSavingsPot = (tx as unknown as PrismaWithSavingsPot).savingsPot;
      if (!txSavingsPot?.deleteMany || !txSavingsPot?.createMany) {
        throw new Error("Savings pot persistence is unavailable in this Prisma client.");
      }
      await txSavingsPot.deleteMany({ where: { budgetPlanId } });

      if (normalized.length > 0) {
        await txSavingsPot.createMany({
          data: normalized.map((pot) => ({
            id: pot.id,
            field: pot.field,
            name: pot.name,
            amount: pot.amount,
            broker: pot.broker,
            allocationId: pot.allocationId ?? null,
            budgetPlanId,
          })),
        });
      }
    });

    const rows = (await savingsPotDelegate.findMany({
      where: { budgetPlanId },
      orderBy: [{ field: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        field: true,
        name: true,
        amount: true,
        broker: true,
        allocationId: true,
      },
    })) as SavingsPotRow[];

    return NextResponse.json({ success: true, pots: rows.map(toResponsePot) });
  } catch (error) {
    console.error("[bff/savings-pots] PUT error", error);
    return NextResponse.json({ error: "Failed to save savings pots" }, { status: 500 });
  }
}
