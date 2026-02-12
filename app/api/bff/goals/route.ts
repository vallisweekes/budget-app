import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const goal = await prisma.goal.create({
      data: {
        title: body.title,
        type: body.type,
        category: body.category,
        description: body.description || null,
        targetAmount: body.targetAmount || null,
        currentAmount: body.currentAmount || 0,
        targetYear: body.targetYear || null,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Failed to create goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
