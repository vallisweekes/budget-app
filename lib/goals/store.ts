import fs from "fs";
import path from "path";

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

const GOALS_FILE = path.join(process.cwd(), "data", "goals.json");

function ensureDataDir() {
  const dir = path.dirname(GOALS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readGoals(): Goal[] {
  ensureDataDir();
  if (!fs.existsSync(GOALS_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(GOALS_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeGoals(goals: Goal[]) {
  ensureDataDir();
  fs.writeFileSync(GOALS_FILE, JSON.stringify(goals, null, 2));
}

export function getAllGoals(): Goal[] {
  return readGoals();
}

export function getGoalsByType(type: "yearly" | "long-term"): Goal[] {
  const goals = readGoals();
  return goals.filter(g => g.type === type);
}

export function getGoalById(id: string): Goal | undefined {
  const goals = readGoals();
  return goals.find(g => g.id === id);
}

export function addGoal(goal: Omit<Goal, "id" | "createdAt">): Goal {
  const goals = readGoals();
  const newGoal: Goal = {
    ...goal,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  goals.push(newGoal);
  writeGoals(goals);
  return newGoal;
}

export function updateGoal(id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>): Goal | null {
  const goals = readGoals();
  const index = goals.findIndex(g => g.id === id);
  if (index === -1) return null;
  
  goals[index] = { ...goals[index], ...updates };
  writeGoals(goals);
  return goals[index];
}

export function deleteGoal(id: string): boolean {
  const goals = readGoals();
  const filtered = goals.filter(g => g.id !== id);
  if (filtered.length === goals.length) return false;
  
  writeGoals(filtered);
  return true;
}
