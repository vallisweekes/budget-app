import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "default",
          payDate: 27,
          monthlyAllowance: 0,
          savingsBalance: 0,
          monthlySavingsContribution: 0,
          monthlyInvestmentContribution: 0,
          budgetStrategy: "payYourselfFirst",
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: body,
      create: {
        id: "default",
        ...body,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
