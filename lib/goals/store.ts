import { prisma } from "@/lib/prisma";

export interface Goal {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term"; // yearly = this year's goal, long-term = 10 year goal
  category: "debt" | "savings" | "emergency" | "investment" | "other";
  targetYear?: number; // for long-term goals
  description?: string;
  createdAt: string;
}

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number((value as any).toString?.() ?? value);
}

function toUiGoalType(value: string): Goal["type"] {
  if (value === "long_term") return "long-term";
  if (value === "yearly") return "yearly";
  return "yearly";
}

function toDbGoalType(value: string): "yearly" | "long_term" {
  if (value === "long-term" || value === "long_term") return "long_term";
  return "yearly";
}

export async function getAllGoals(budgetPlanId: string): Promise<Goal[]> {
  const rows = await prisma.goal.findMany({
    where: { budgetPlanId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      description: true,
      targetAmount: true,
      currentAmount: true,
      targetYear: true,
      createdAt: true,
    },
  });

  return rows.map((g) => ({
    id: g.id,
    title: g.title,
    type: toUiGoalType(g.type),
    category: g.category as any,
    description: g.description ?? undefined,
    targetAmount: g.targetAmount == null ? undefined : decimalToNumber(g.targetAmount),
    currentAmount: g.currentAmount == null ? undefined : decimalToNumber(g.currentAmount),
    targetYear: g.targetYear ?? undefined,
    createdAt: g.createdAt.toISOString(),
  }));
}

export async function getGoalsByType(budgetPlanId: string, type: "yearly" | "long-term"): Promise<Goal[]> {
  const goals = await getAllGoals(budgetPlanId);
  return goals.filter((g) => g.type === type);
}

export async function getGoalById(budgetPlanId: string, id: string): Promise<Goal | undefined> {
  const row = await prisma.goal.findFirst({
    where: { id, budgetPlanId },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      description: true,
      targetAmount: true,
      currentAmount: true,
      targetYear: true,
      createdAt: true,
    },
  });
  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    type: toUiGoalType(row.type),
    category: row.category as any,
    description: row.description ?? undefined,
    targetAmount: row.targetAmount == null ? undefined : decimalToNumber(row.targetAmount),
    currentAmount: row.currentAmount == null ? undefined : decimalToNumber(row.currentAmount),
    targetYear: row.targetYear ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function addGoal(budgetPlanId: string, goal: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
  const created = await prisma.goal.create({
    data: {
      budgetPlanId,
      title: goal.title,
      type: toDbGoalType(goal.type),
      category: goal.category as any,
      description: goal.description ?? null,
      targetAmount: goal.targetAmount ?? null,
      currentAmount: goal.currentAmount ?? 0,
      targetYear: goal.targetYear ?? null,
    },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      description: true,
      targetAmount: true,
      currentAmount: true,
      targetYear: true,
      createdAt: true,
    },
  });
  return {
    id: created.id,
    title: created.title,
    type: toUiGoalType(created.type),
    category: created.category as any,
    description: created.description ?? undefined,
    targetAmount: created.targetAmount == null ? undefined : decimalToNumber(created.targetAmount),
    currentAmount: created.currentAmount == null ? undefined : decimalToNumber(created.currentAmount),
    targetYear: created.targetYear ?? undefined,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateGoal(
  budgetPlanId: string,
  id: string,
  updates: Partial<Omit<Goal, "id" | "createdAt">>
): Promise<Goal | null> {
  const existing = await prisma.goal.findFirst({ where: { id, budgetPlanId }, select: { id: true } });
  if (!existing) return null;
  const updated = await prisma.goal.update({
    where: { id: existing.id },
    data: {
      title: updates.title,
      description: updates.description === undefined ? undefined : updates.description ?? null,
      targetAmount: updates.targetAmount === undefined ? undefined : updates.targetAmount ?? null,
      currentAmount: updates.currentAmount === undefined ? undefined : updates.currentAmount ?? null,
      targetYear: updates.targetYear === undefined ? undefined : updates.targetYear ?? null,
    },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      description: true,
      targetAmount: true,
      currentAmount: true,
      targetYear: true,
      createdAt: true,
    },
  });
  return {
    id: updated.id,
    title: updated.title,
    type: toUiGoalType(updated.type),
    category: updated.category as any,
    description: updated.description ?? undefined,
    targetAmount: updated.targetAmount == null ? undefined : decimalToNumber(updated.targetAmount),
    currentAmount: updated.currentAmount == null ? undefined : decimalToNumber(updated.currentAmount),
    targetYear: updated.targetYear ?? undefined,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteGoal(budgetPlanId: string, id: string): Promise<boolean> {
  const deleted = await prisma.goal.deleteMany({ where: { id, budgetPlanId } });
  return deleted.count > 0;
}
