/**
 * useYearGuard
 *
 * Returns helpers to prevent navigating to a year before the user's
 * account creation date. On the web the same logic lives in
 * ExpensesPageClient.tsx and IncomeScreen.tsx (isBeforeUserStartMonth).
 *
 * Usage:
 *   const { minYear, minMonth, canDecrement } = useYearGuard(settings);
 *   if (!canDecrement(year, month)) return; // don't allow going back
 */

import type { Settings } from "@/lib/apiTypes";

interface YearGuard {
  /** Earliest year the user may navigate to */
  minYear: number;
  /** Earliest month (1-12) in minYear the user may navigate to */
  minMonth: number;
  /** True if decrementing month (or year) from current position is allowed */
  canDecrement: (currentYear: number, currentMonth: number) => boolean;
}

const FALLBACK_YEAR = 2020;

export function useYearGuard(settings: Settings | null): YearGuard {
  const now = new Date();
  const currentYear = now.getFullYear();

  let minYear = FALLBACK_YEAR;
  let minMonth = 1;

  if (settings?.accountCreatedAt) {
    try {
      const d = new Date(settings.accountCreatedAt);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1; // 1-12

      // Only enforce the guard for the current year and forward.
      // If the DB has no data before signup and we're in the signup year,
      // don't let the user go earlier than their signup month.
      if (y >= currentYear) {
        minYear = y;
        minMonth = m;
      } else {
        // Signed up in a previous year — let them browse all of that year
        minYear = y;
        minMonth = 1;
      }
    } catch {
      // Invalid date — fall back to safe default
    }
  }

  const canDecrement = (year: number, month: number): boolean => {
    // Going back from month 1 → month 12 of previous year
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    if (prevYear < minYear) return false;
    if (prevYear === minYear && prevMonth < minMonth) return false;
    return true;
  };

  return { minYear, minMonth, canDecrement };
}
