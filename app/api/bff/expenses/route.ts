import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function resolveBudgetPlanId(maybeBudgetPlanId: string | null): Promise<string | null> {
  const budgetPlanId = maybeBudgetPlanId?.trim();
  if (budgetPlanId) return budgetPlanId;

  const plan = await prisma.budgetPlan.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return plan?.id ?? null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function decimalToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof (value as { toString: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "0";
}

function serializeExpense(expense: {
  id: string;
  name: string;
  amount: unknown;
  paid: boolean;
  paidAmount: unknown;
  month: number;
  year: number;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    featured: boolean;
  } | null;
}) {
  return {
    id: expense.id,
    name: expense.name,
    amount: decimalToString(expense.amount),
    paid: expense.paid,
    paidAmount: decimalToString(expense.paidAmount),
    month: expense.month,
    year: expense.year,
    categoryId: expense.categoryId,
    category: expense.category ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = toNumber(searchParams.get("month"));
  const year = toNumber(searchParams.get("year"));
  const budgetPlanId = await resolveBudgetPlanId(searchParams.get("budgetPlanId"));

  if (month == null || month < 1 || month > 12) return badRequest("Invalid month");
  if (year == null || year < 1900) return badRequest("Invalid year");
  if (!budgetPlanId) return badRequest("No budget plan found. Create a budget plan first.");

  const items = await prisma.expense.findMany({
    where: { budgetPlanId, month, year },
    orderBy: [{ createdAt: "asc" }],
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
  });

  return NextResponse.json(items.map(serializeExpense));
}

export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");

  const body = raw as {
    budgetPlanId?: unknown;
    name?: unknown;
    amount?: unknown;
    month?: unknown;
    year?: unknown;
    categoryId?: unknown;
    paid?: unknown;
  };

  const budgetPlanId =
    typeof body.budgetPlanId === "string" ? body.budgetPlanId.trim() : "";

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount = Number(body.amount);
  const month = Number(body.month);
  const year = Number(body.year);
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : undefined;
  const paid = Boolean(body.paid ?? false);

  if (!budgetPlanId) return badRequest("budgetPlanId is required");
  if (!name) return badRequest("Name is required");
  if (!Number.isFinite(amount) || amount < 0) return badRequest("Amount must be a number >= 0");
  if (!Number.isFinite(month) || month < 1 || month > 12) return badRequest("Invalid month");
  if (!Number.isFinite(year) || year < 1900) return badRequest("Invalid year");

  const created = await prisma.expense.create({
    data: {
      name,
      amount: String(amount),
      paid,
      paidAmount: String(paid ? amount : 0),
      month,
      year,
      categoryId: categoryId ? categoryId : null,
      budgetPlanId,
    },
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
  });

  return NextResponse.json(serializeExpense(created), { status: 201 });
}
