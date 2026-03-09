import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";

import { parseSavingsPotStore } from "@/lib/helpers/settings";
import type { SavingsPot } from "@/types/settings";

const SAVINGS_POTS_KEY = "budget_app.savings_pots.v1";

export function useSavingsPotStore() {
  const readSavingsPotsForPlan = useCallback(async (planId: string): Promise<SavingsPot[]> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
    const store = parseSavingsPotStore(raw);
    return Array.isArray(store[planId]) ? store[planId] : [];
  }, []);

  const writeSavingsPotsForPlan = useCallback(async (planId: string, pots: SavingsPot[]): Promise<void> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
    const store = parseSavingsPotStore(raw);
    store[planId] = pots;
    await SecureStore.setItemAsync(SAVINGS_POTS_KEY, JSON.stringify(store));
  }, []);

  return {
    readSavingsPotsForPlan,
    writeSavingsPotsForPlan,
  };
}
