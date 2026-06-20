type ExpenseDetailReturnTarget = "dashboard";

type ContextEntry = {
  target: ExpenseDetailReturnTarget;
  expiresAt: number;
};

const CONTEXT_TTL_MS = 5 * 60 * 1000;
const contextByExpenseId = new Map<string, ContextEntry>();

function normalizeId(value: string): string {
  return String(value ?? "").trim();
}

export function setExpenseDetailReturnContext(expenseId: string, target: ExpenseDetailReturnTarget): void {
  const id = normalizeId(expenseId);
  if (!id) return;
  contextByExpenseId.set(id, {
    target,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  });
}

export function getExpenseDetailReturnContext(expenseId: string): ExpenseDetailReturnTarget | null {
  const id = normalizeId(expenseId);
  if (!id) return null;

  const entry = contextByExpenseId.get(id);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    contextByExpenseId.delete(id);
    return null;
  }

  return entry.target;
}
