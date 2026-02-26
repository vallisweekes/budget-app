import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });

    if (!category || category.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

		const { budgetPlan, ...safe } = category;
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!existing || existing.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.name === "string") data.name = raw.name;
    if (typeof raw.icon === "string" || raw.icon === null) data.icon = raw.icon;
    if (typeof raw.color === "string" || raw.color === null) data.color = raw.color;
    if (typeof raw.featured === "boolean") data.featured = raw.featured;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
		const category = await prisma.category.findUnique({
			where: { id },
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!category || category.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Category not found" }, { status: 404 });
		}

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
