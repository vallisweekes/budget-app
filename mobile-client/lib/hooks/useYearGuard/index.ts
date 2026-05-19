/**
 * useYearGuard
 *
 * Returns helpers to prevent navigating to a period before the user's
 * first selectable pay period.
 *
 * Usage:
 *   const { minYear, minMonth, canDecrement } = useYearGuard(settings);
 *   if (!canDecrement(year, month)) return; // don't allow going back
 */

import { useCallback, useMemo } from "react";
import type { Settings } from "@/lib/apiTypes";
import { normalizePayFrequency, resolveFirstSelectablePayPeriodWindow } from "@/lib/payPeriods";

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
  const { minYear, minMonth } = useMemo(() => {
    let minYear = FALLBACK_YEAR;
    let minMonth = 1;

    const rawPlanStartAt = settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? null;
    if (rawPlanStartAt) {
      try {
        const planStartAt = new Date(rawPlanStartAt);
        if (Number.isNaN(planStartAt.getTime())) {
          return { minYear, minMonth };
        }

        const firstSelectable = resolveFirstSelectablePayPeriodWindow({
          payDate: settings?.payDate ?? 27,
          payFrequency: normalizePayFrequency(settings?.payFrequency),
          payAnchorDate: settings?.payAnchorDate ?? null,
          planStartAt,
        });
        minYear = firstSelectable.start.getFullYear();
        minMonth = firstSelectable.start.getMonth() + 1;
      } catch {
        // Invalid date — fall back to safe default
      }
    }
    return { minYear, minMonth };
  }, [settings?.accountCreatedAt, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency, settings?.setupCompletedAt]);

  const canDecrement = useCallback((year: number, month: number): boolean => {
    // Going back from month 1 → month 12 of previous year
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    if (prevYear < minYear) return false;
    if (prevYear === minYear && prevMonth < minMonth) return false;
    return true;
  }, [minYear, minMonth]);

  return { minYear, minMonth, canDecrement };
}
