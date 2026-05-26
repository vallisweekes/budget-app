import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { resolveActivePayPeriod, type PayFrequency } from "@/lib/payPeriods";

type UsePayPeriodBoundaryRefreshParams = {
  enabled: boolean;
  identityKey: string;
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
  planCreatedAt?: Date | null;
};

function getPeriodKey(period: { start: Date; end: Date }): string {
  return `${period.start.getTime()}:${period.end.getTime()}`;
}

function getNextBoundaryTime(periodEnd: Date): number {
  const next = new Date(periodEnd.getTime());
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function usePayPeriodBoundaryRefresh(params: UsePayPeriodBoundaryRefreshParams): number {
  const { enabled, identityKey, payDate, payFrequency, payAnchorDate, planCreatedAt } = params;
  const [boundaryVersion, setBoundaryVersion] = useState(0);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const lastObservedPeriodKeyRef = useRef<string | null>(null);
  const lastIdentityKeyRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      setScheduleVersion((current) => current + 1);
    });

    return () => {
      sub.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !identityKey) return;

    if (lastIdentityKeyRef.current !== identityKey) {
      lastIdentityKeyRef.current = identityKey;
      lastObservedPeriodKeyRef.current = null;
    }

    const now = new Date();
    const activePeriod = resolveActivePayPeriod({
      now,
      payDate,
      payFrequency,
      payAnchorDate,
      planCreatedAt,
    });
    const activePeriodKey = getPeriodKey(activePeriod);

    if (lastObservedPeriodKeyRef.current && lastObservedPeriodKeyRef.current !== activePeriodKey) {
      lastObservedPeriodKeyRef.current = activePeriodKey;
      setBoundaryVersion((current) => current + 1);
    } else if (!lastObservedPeriodKeyRef.current) {
      lastObservedPeriodKeyRef.current = activePeriodKey;
    }

    const nextBoundaryTime = getNextBoundaryTime(activePeriod.end);
    const delayMs = Math.max(1000, Math.min(nextBoundaryTime - now.getTime(), 2_147_483_647));
    const timeoutId = setTimeout(() => {
      setScheduleVersion((current) => current + 1);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [enabled, identityKey, payAnchorDate, payDate, payFrequency, planCreatedAt?.getTime(), scheduleVersion]);

  return boundaryVersion;
}

export default usePayPeriodBoundaryRefresh;