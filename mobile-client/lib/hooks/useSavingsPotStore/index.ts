import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";

import { mapSavingsFieldToSacrificeType, parseSavingsPotStore } from "@/lib/helpers/settings";
import { apiFetch } from "@/lib/api";
import type { CreateSacrificeItemResponse, SavingsPot } from "@/types/settings";

const SAVINGS_POTS_KEY = "budget_app.savings_pots.v1";
const SAVINGS_POT_MIGRATIONS_KEY = "budget_app.savings_pot_migrations.v1";

type SavingsPotMigrationStore = Record<string, {
  investmentSplit20260529?: boolean;
}>;

function parseSavingsPotMigrationStore(raw: string | null): SavingsPotMigrationStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as SavingsPotMigrationStore;
  } catch {
    return {};
  }
}

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

  const ensureSavingsPotAllocationLinks = useCallback(async (planId: string, pots: SavingsPot[]): Promise<SavingsPot[]> => {
    const missingLinks = pots.filter((pot) => !pot.allocationId);
    if (missingLinks.length === 0) return pots;

    const now = new Date();
    let didUpdate = false;
    const syncedPots = [...pots];

    for (let i = 0; i < syncedPots.length; i += 1) {
      const pot = syncedPots[i];
      if (!pot || pot.allocationId) continue;

      try {
        const created = await apiFetch<CreateSacrificeItemResponse>("/api/bff/income-sacrifice/custom", {
          method: "POST",
          body: {
            budgetPlanId: planId,
            type: mapSavingsFieldToSacrificeType(pot.field),
            name: pot.name,
            amount: 0,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          },
        });

        const allocationId = typeof created?.item?.id === "string" ? created.item.id.trim() : "";
        if (!allocationId) continue;

        syncedPots[i] = {
          ...pot,
          allocationId,
        };
        didUpdate = true;
      } catch {
        // Keep the local pot even if link creation fails.
      }
    }

    if (didUpdate) {
      await writeSavingsPotsForPlan(planId, syncedPots);
    }

    return syncedPots;
  }, [writeSavingsPotsForPlan]);

  const hasInvestmentSplitMigrationForPlan = useCallback(async (planId: string): Promise<boolean> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POT_MIGRATIONS_KEY);
    const store = parseSavingsPotMigrationStore(raw);
    return store[planId]?.investmentSplit20260529 === true;
  }, []);

  const markInvestmentSplitMigrationForPlan = useCallback(async (planId: string): Promise<void> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POT_MIGRATIONS_KEY);
    const store = parseSavingsPotMigrationStore(raw);
    store[planId] = {
      ...store[planId],
      investmentSplit20260529: true,
    };
    await SecureStore.setItemAsync(SAVINGS_POT_MIGRATIONS_KEY, JSON.stringify(store));
  }, []);

  return {
    readSavingsPotsForPlan,
    writeSavingsPotsForPlan,
    ensureSavingsPotAllocationLinks,
    hasInvestmentSplitMigrationForPlan,
    markInvestmentSplitMigrationForPlan,
  };
}
