import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, color: true, featured: true },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = await prisma.category.create({
      data: {
        name: body.name,
        icon: body.icon || null,
        color: body.color || null,
        featured: body.featured || false,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}

