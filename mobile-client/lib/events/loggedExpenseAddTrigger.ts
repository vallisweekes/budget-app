let token = 0;

const listeners = new Set<(nextToken: number) => void>();

export function emitLoggedExpenseAddTrigger(): number {
  token += 1;
  for (const listener of listeners) {
    try {
      listener(token);
    } catch {
      // keep UI resilient
    }
  }
  return token;
}

export function subscribeLoggedExpenseAddTrigger(listener: (nextToken: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
