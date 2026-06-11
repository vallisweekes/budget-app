import { prisma } from "@/lib/prisma";
import {
  getMonthlyAllocationSnapshot,
  getMonthlyCustomAllocationsSnapshot,
} from "@/lib/allocations/store";
import { invalidateGoalConnectedState } from "@/lib/goals/invalidateGoalConnectedState";
import { runLegacyGoalSync } from "@/lib/income-sacrifice/legacyGoalSyncState";
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

type AllocationDefinitionDelegate = {
  findMany?: (args: Record<string, unknown>) => Promise<Array<{ id: string; name: string }>>;
};

type GoalListDelegate = {
  findMany?: (args: Record<string, unknown>) => Promise<Array<{ id: string; title: string }>>;
  create?: (args: Record<string, unknown>) => Promise<{ id: string }>;
};

function normalizeGoalTitle(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function inferGoalCategory(title: string): "debt" | "emergency" | "savings" | "investment" | "other" {
  const normalized = normalizeGoalTitle(title);
  if (normalized.includes("emergency")) return "emergency";
  if (normalized.includes("saving")) return "savings";
  if (normalized.includes("debt")) return "debt";
  if (normalized.includes("invest")) return "investment";
  return "other";
}

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

export async function ensureLegacyCustomSacrificesHaveGoals(budgetPlanId: string): Promise<void> {
  await runLegacyGoalSync(budgetPlanId, async () => {
    const allocationDefinition = (prisma as unknown as { allocationDefinition?: AllocationDefinitionDelegate }).allocationDefinition;
    const linkDelegate = (prisma as unknown as { sacrificeGoalLink?: SacrificeGoalLinkDelegate }).sacrificeGoalLink;
    const goalDelegate = (prisma as unknown as { goal?: GoalListDelegate }).goal;

    if (!allocationDefinition?.findMany || !linkDelegate?.findMany || !linkDelegate?.upsert || !goalDelegate?.findMany || !goalDelegate?.create) {
      return false;
    }

    const [allocations, existingLinks, existingGoals] = await Promise.all([
      allocationDefinition.findMany({
        where: { budgetPlanId, isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      linkDelegate.findMany({
        where: { budgetPlanId, targetKey: { startsWith: "custom:" } },
        select: {
          id: true,
          targetKey: true,
          goalId: true,
          goal: { select: { title: true, category: true } },
        },
      }),
      goalDelegate.findMany({
        where: { budgetPlanId },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, title: true },
      }),
    ]);

    const linkedTargetKeys = new Set(existingLinks.map((link) => String(link.targetKey).trim()));
    const goalIdByTitle = new Map<string, string>();

    for (const goal of existingGoals) {
      const normalizedTitle = normalizeGoalTitle(goal.title);
      if (!normalizedTitle || goalIdByTitle.has(normalizedTitle)) continue;
      goalIdByTitle.set(normalizedTitle, goal.id);
    }

    for (const allocation of allocations) {
      const targetKey = `custom:${allocation.id}`;
      if (linkedTargetKeys.has(targetKey)) continue;

      const title = String(allocation.name ?? "").trim() || "Custom sacrifice";
      const normalizedTitle = normalizeGoalTitle(title);

      let goalId = goalIdByTitle.get(normalizedTitle);
      if (!goalId) {
        const createdGoal = await goalDelegate.create({
          data: {
            title,
            type: "long_term",
            category: inferGoalCategory(title),
            description: "Backfilled from an older custom sacrifice. Update the target amount and year if needed.",
            targetAmount: null,
            currentAmount: 0,
            targetYear: null,
            budgetPlanId,
          },
          select: { id: true },
        });
        goalId = String(createdGoal.id);
        if (normalizedTitle) {
          goalIdByTitle.set(normalizedTitle, goalId);
        }
      }

      await linkDelegate.upsert({
        where: {
          budgetPlanId_targetKey: {
            budgetPlanId,
            targetKey,
          },
        },
        create: {
          budgetPlanId,
          targetKey,
          goalId,
        },
        update: { goalId },
      });
    }

    return true;
  });
}

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
    const allocation = await getMonthlyAllocationSnapshot(params.budgetPlanId, monthKey, {
      year: params.year,
      fallbackToPlanDefaults: false,
    });
    return Number(allocation[parsed.fixedField as keyof typeof allocation] ?? 0);
  }

  const custom = await getMonthlyCustomAllocationsSnapshot(params.budgetPlanId, monthKey, {
    year: params.year,
    fallbackToDefinitionDefaults: false,
  });
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

  await invalidateGoalConnectedState(params.budgetPlanId);
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

  await invalidateGoalConnectedState(params.budgetPlanId);
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

  await invalidateGoalConnectedState(params.budgetPlanId);

  return {
    created: true,
    amount,
    goalId: String(link.goalId),
  };
}
