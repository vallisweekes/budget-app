export type SessionScopedResetter = () => void | Promise<void>;

const sessionScopedResetters = new Set<SessionScopedResetter>();

export function registerSessionScopedResetter(resetter: SessionScopedResetter): void {
  sessionScopedResetters.add(resetter);
}

export async function resetSessionScopedMobileState(): Promise<void> {
  const pending = Array.from(sessionScopedResetters, async (resetter) => {
    try {
      await resetter();
    } catch {
      // Best-effort cache clearing only.
    }
  });

  await Promise.allSettled(pending);
}