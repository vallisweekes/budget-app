import fs from "fs";
import path from "path";
import { getBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";

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

function goalsFilePath(budgetPlanId: string) {
  return getBudgetDataFilePath(budgetPlanId, "goals.json");
}


function ensureDataDir(budgetPlanId: string) {
  const dir = getBudgetDataDir(budgetPlanId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readGoals(budgetPlanId: string): Goal[] {
  ensureDataDir(budgetPlanId);
  const file = goalsFilePath(budgetPlanId);
  if (!fs.existsSync(file)) {
    return [];
  }
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw);
}

function writeGoals(budgetPlanId: string, goals: Goal[]) {
  ensureDataDir(budgetPlanId);
  fs.writeFileSync(goalsFilePath(budgetPlanId), JSON.stringify(goals, null, 2));
}

export function getAllGoals(budgetPlanId: string): Goal[] {
  return readGoals(budgetPlanId);
}

export function getGoalsByType(budgetPlanId: string, type: "yearly" | "long-term"): Goal[] {
  const goals = readGoals(budgetPlanId);
  return goals.filter(g => g.type === type);
}

export function getGoalById(budgetPlanId: string, id: string): Goal | undefined {
  const goals = readGoals(budgetPlanId);
  return goals.find(g => g.id === id);
}

export function addGoal(budgetPlanId: string, goal: Omit<Goal, "id" | "createdAt">): Goal {
  const goals = readGoals(budgetPlanId);
  const newGoal: Goal = {
    ...goal,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  goals.push(newGoal);
  writeGoals(budgetPlanId, goals);
  return newGoal;
}

export function updateGoal(budgetPlanId: string, id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>): Goal | null {
  const goals = readGoals(budgetPlanId);
  const index = goals.findIndex(g => g.id === id);
  if (index === -1) return null;
  
  goals[index] = { ...goals[index], ...updates };
  writeGoals(budgetPlanId, goals);
  return goals[index];
}

export function deleteGoal(budgetPlanId: string, id: string): boolean {
  const goals = readGoals(budgetPlanId);
  const filtered = goals.filter(g => g.id !== id);
  if (filtered.length === goals.length) return false;
  
  writeGoals(budgetPlanId, filtered);
  return true;
}
