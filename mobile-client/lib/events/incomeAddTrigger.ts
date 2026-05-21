let token = 0;

const listeners = new Set<(nextToken: number) => void>();

export function emitIncomeAddTrigger(): number {
  token += 1;
  for (const listener of listeners) {
    try {
      listener(token);
    } catch {
      // Ignore listener failures to keep UI interaction resilient.
    }
  }
  return token;
}

export function subscribeIncomeAddTrigger(listener: (nextToken: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}