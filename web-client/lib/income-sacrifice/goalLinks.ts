import { prisma } from "@/lib/prisma";
import {
  getMonthlyAllocationSnapshot,
  getMonthlyCustomAllocationsSnapshot,
} from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number((value as { toString?: () => string }).toString?.() ?? value);
}

export type SacrificeTargetKind = "fixed" | "custom";

export type ParsedSacrificeTarget = {
  kind: SacrificeTargetKind;
  fixedField?: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
  allocationId?: string;
};

export type SacrificeGoalLinkRecord = {
  id: string;
  targetKey: string;
  goalId: string;
  goalTitle: string;
  goalCategory: string;
};

export type SacrificeTransferRecord = {
  id: string;
  year: number;
  month: number;
  targetKey: string;
  amount: number;
  goalId: string;
  confirmedAt: string;
};

type SacrificeGoalLinkRow = {
  id: string;
  targetKey: string;
  goalId: string;
  goal: { title: string; category: string } | null;
};

type SacrificeGoalLinkLookupRow = { goalId: string };

type SacrificeTransferRow = {
  id: string;
  year: number;
  month: number;
  targetKey: string;
  amount: unknown;
  goalId: string;
  confirmedAt: Date;
};

type SacrificeTransferLookupRow = { amount: unknown; goalId: string };

type SacrificeGoalLinkDelegate = {
  findMany?: (args: Record<string, unknown>) => Promise<SacrificeGoalLinkRow[]>;
  findUnique?: (args: Record<string, unknown>) => Promise<SacrificeGoalLinkLookupRow | null>;
  upsert?: (args: Record<string, unknown>) => Promise<unknown>;
  deleteMany?: (args: Record<string, unknown>) => Promise<unknown>;
};

type SacrificeTransferDelegate = {
  findMany?: (args: Record<string, unknown>) => Promise<SacrificeTransferRow[]>;
  findUnique?: (args: Record<string, unknown>) => Promise<SacrificeTransferLookupRow | null>;
  create?: (args: Record<string, unknown>) => Promise<unknown>;
};

type GoalUpdateDelegate = {
  update?: (args: Record<string, unknown>) => Promise<unknown>;
};

export function parseTargetKey(targetKey: string): ParsedSacrificeTarget | null {
  const value = targetKey.trim();
  if (!value) return null;

  if (value.startsWith("fixed:")) {
    const field = value.slice("fixed:".length);
    if (
      field === "monthlyAllowance" ||
      field === "monthlySavingsContribution" ||
      field === "monthlyEmergencyContribution" ||
      field === "monthlyInvestmentContribution"
    ) {
      return { kind: "fixed", fixedField: field };
    }
    return null;
  }

  if (value.startsWith("custom:")) {
    const allocationId = value.slice("custom:".length).trim();
    if (!allocationId) return null;
    return { kind: "custom", allocationId };
  }

  return null;
}

export async function getPlannedAmountForTarget(params: {
  budgetPlanId: string;
  year: number;
  month: number;
  targetKey: string;
}): Promise<number> {
  const parsed = parseTargetKey(params.targetKey);
  if (!parsed) return 0;

  const monthKey = monthNumberToKey(params.month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;

  if (parsed.kind === "fixed") {
    const allocation = await getMonthlyAllocationSnapshot(params.budgetPlanId, monthKey, { year: params.year });
    return Number(allocation[parsed.fixedField as keyof typeof allocation] ?? 0);
  }

  const custom = await getMonthlyCustomAllocationsSnapshot(params.budgetPlanId, monthKey, { year: params.year });
  const match = custom.items.find((row) => row.id === parsed.allocationId);
  return Number(match?.amount ?? 0);
}

export async function listSacrificeGoalLinks(budgetPlanId: string): Promise<SacrificeGoalLinkRecord[]> {
  const delegate = (prisma as unknown as { sacrificeGoalLink?: SacrificeGoalLinkDelegate }).sacrificeGoalLink;
  if (!delegate?.findMany) return [];

  const rows = await delegate.findMany({
    where: { budgetPlanId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      targetKey: true,
      goalId: true,
      goal: { select: { title: true, category: true } },
    },
  });

  return rows.map((row) => ({
    id: String(row.id),
    targetKey: String(row.targetKey),
    goalId: String(row.goalId),
    goalTitle: String(row.goal?.title ?? "Goal"),
    goalCategory: String(row.goal?.category ?? "other"),
  }));
}

export async function upsertSacrificeGoalLink(params: {
  budgetPlanId: string;
  targetKey: string;
  goalId: string;
}): Promise<void> {
  const delegate = (prisma as unknown as { sacrificeGoalLink?: SacrificeGoalLinkDelegate }).sacrificeGoalLink;
  if (!delegate?.upsert) {
    throw new Error("Sacrifice goal links are not available yet. Restart the server after applying migrations.");
  }

  await delegate.upsert({
    where: {
      budgetPlanId_targetKey: {
        budgetPlanId: params.budgetPlanId,
        targetKey: params.targetKey,
      },
    },
    create: {
      budgetPlanId: params.budgetPlanId,
      targetKey: params.targetKey,
      goalId: params.goalId,
    },
    update: { goalId: params.goalId },
  });
}

export async function removeSacrificeGoalLink(params: {
  budgetPlanId: string;
  targetKey: string;
}): Promise<void> {
  const delegate = (prisma as unknown as { sacrificeGoalLink?: SacrificeGoalLinkDelegate }).sacrificeGoalLink;
  if (!delegate?.deleteMany) return;

  await delegate.deleteMany({
    where: {
      budgetPlanId: params.budgetPlanId,
      targetKey: params.targetKey,
    },
  });
}

export async function listSacrificeTransferConfirmations(params: {
  budgetPlanId: string;
  year: number;
  month: number;
}): Promise<SacrificeTransferRecord[]> {
  const delegate = (prisma as unknown as { sacrificeTransferConfirmation?: SacrificeTransferDelegate }).sacrificeTransferConfirmation;
  if (!delegate?.findMany) return [];

  const rows = await delegate.findMany({
    where: {
      budgetPlanId: params.budgetPlanId,
      year: params.year,
      month: params.month,
    },
    orderBy: [{ confirmedAt: "asc" }],
    select: {
      id: true,
      year: true,
      month: true,
      targetKey: true,
      amount: true,
      goalId: true,
      confirmedAt: true,
    },
  });

  return rows.map((row) => ({
    id: String(row.id),
    year: Number(row.year),
    month: Number(row.month),
    targetKey: String(row.targetKey),
    amount: decimalToNumber(row.amount),
    goalId: String(row.goalId),
    confirmedAt: new Date(row.confirmedAt).toISOString(),
  }));
}

export async function confirmSacrificeTransfer(params: {
  budgetPlanId: string;
  year: number;
  month: number;
  targetKey: string;
}): Promise<{ created: boolean; amount: number; goalId: string }> {
  const linkDelegate = (prisma as unknown as { sacrificeGoalLink?: SacrificeGoalLinkDelegate }).sacrificeGoalLink;
  const transferDelegate = (prisma as unknown as { sacrificeTransferConfirmation?: SacrificeTransferDelegate }).sacrificeTransferConfirmation;
  const goalDelegate = (prisma as unknown as { goal?: GoalUpdateDelegate }).goal;

  if (!linkDelegate?.findUnique || !transferDelegate?.findUnique || !goalDelegate?.update) {
    throw new Error("Sacrifice transfer confirmations are not available yet. Restart the server after applying migrations.");
  }

  const link = await linkDelegate.findUnique({
    where: {
      budgetPlanId_targetKey: {
        budgetPlanId: params.budgetPlanId,
        targetKey: params.targetKey,
      },
    },
    select: { goalId: true },
  });

  if (!link?.goalId) {
    throw new Error("No linked goal for this sacrifice target.");
  }

  const existing = await transferDelegate.findUnique({
    where: {
      budgetPlanId_year_month_targetKey: {
        budgetPlanId: params.budgetPlanId,
        year: params.year,
        month: params.month,
        targetKey: params.targetKey,
      },
    },
    select: { amount: true, goalId: true },
  });

  if (existing) {
    return {
      created: false,
      amount: decimalToNumber(existing.amount),
      goalId: String(existing.goalId),
    };
  }

  const amount = await getPlannedAmountForTarget({
    budgetPlanId: params.budgetPlanId,
    year: params.year,
    month: params.month,
    targetKey: params.targetKey,
  });

  await prisma.$transaction(async (tx) => {
    const txTransfer = (tx as unknown as { sacrificeTransferConfirmation?: SacrificeTransferDelegate }).sacrificeTransferConfirmation;
    const txGoal = (tx as unknown as { goal?: GoalUpdateDelegate }).goal;

    if (!txTransfer?.create || !txGoal?.update) {
      throw new Error("Sacrifice transfer confirmations are not available yet. Restart the server after applying migrations.");
    }

    await txTransfer.create({
      data: {
        budgetPlanId: params.budgetPlanId,
        goalId: String(link.goalId),
        year: params.year,
        month: params.month,
        targetKey: params.targetKey,
        amount,
      },
    });

    await txGoal.update({
      where: { id: String(link.goalId) },
      data: {
        currentAmount: {
          increment: amount,
        },
      },
    });
  });

  return {
    created: true,
    amount,
    goalId: String(link.goalId),
  };
}
