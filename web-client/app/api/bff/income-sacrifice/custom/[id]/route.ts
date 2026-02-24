import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await getSessionUserId();
		if (!userId) return unauthorized();

		const { id } = await params;
		const row = await prisma.allocationDefinition.findUnique({
			where: { id },
			select: { id: true, budgetPlan: { select: { userId: true } } },
		});
		if (!row || row.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
		}

		await prisma.allocationDefinition.update({
			where: { id },
			data: { isArchived: true },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[bff/income-sacrifice/custom/:id] DELETE error", error);
		return NextResponse.json({ error: "Failed to delete sacrifice item" }, { status: 500 });
	}
}
