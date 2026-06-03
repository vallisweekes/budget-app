import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";

import { mapSavingsFieldToSacrificeType, parseSavingsPotStore } from "@/lib/helpers/settings";
import { apiFetch } from "@/lib/api";
import type { CreateSacrificeItemResponse, SavingsField, SavingsPot } from "@/types/settings";

const SAVINGS_POTS_KEY = "budget_app.savings_pots.v1";
const SAVINGS_POT_MIGRATIONS_KEY = "budget_app.savings_pot_migrations.v1";
const SAVINGS_POTS_ENDPOINT = "/api/bff/savings-pots";

type SavingsPotApiRecord = {
  id: string;
  field: SavingsField;
  name: string;
  amount: number;
  broker: string;
  allocationId?: string;
};

type SavingsPotMigrationStore = Record<string, {
  investmentSplit20260529?: boolean;
}>;

function countInvestmentPots(pots: SavingsPot[]): number {
  return pots.reduce((count, pot) => (pot.field === "investment" ? count + 1 : count), 0);
}

function normalizeSavingsPotBroker(value: unknown): string {
  if (typeof value !== "string") return "none";
  const normalized = value.trim();
  return normalized || "none";
}

function normalizeSavingsPot(planId: string, raw: unknown, index: number): SavingsPot | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;

  const field = rec.field;
  if (field !== "savings" && field !== "emergency" && field !== "investment") {
    return null;
  }

  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!name) return null;

  const amountRaw = rec.amount;
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const id = typeof rec.id === "string" && rec.id.trim()
    ? rec.id.trim()
    : `${planId}-${field}-${name.toLowerCase().replace(/\s+/g, "-")}-${index}`;

  const allocationId = typeof rec.allocationId === "string" && rec.allocationId.trim()
    ? rec.allocationId.trim()
    : undefined;

  return {
    id,
    field,
    name,
    amount,
    broker: normalizeSavingsPotBroker(rec.broker),
    ...(allocationId ? { allocationId } : {}),
  };
}

function serializeSavingsPots(pots: SavingsPot[]): SavingsPotApiRecord[] {
  return pots.map((pot) => ({
    id: pot.id,
    field: pot.field,
    name: pot.name,
    amount: pot.amount,
    broker: normalizeSavingsPotBroker(pot.broker),
    ...(pot.allocationId ? { allocationId: pot.allocationId } : {}),
  }));
}

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
  const writeSavingsPotsToLocalStore = useCallback(async (planId: string, pots: SavingsPot[]): Promise<void> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
    const store = parseSavingsPotStore(raw);
    store[planId] = pots;
    await SecureStore.setItemAsync(SAVINGS_POTS_KEY, JSON.stringify(store));
  }, []);

  const syncSavingsPotsToServer = useCallback(async (planId: string, pots: SavingsPot[]): Promise<void> => {
    await apiFetch<{ success?: boolean }>(SAVINGS_POTS_ENDPOINT, {
      method: "PUT",
      body: {
        budgetPlanId: planId,
        pots: serializeSavingsPots(pots),
      },
    });
  }, []);

  const readSavingsPotsForPlan = useCallback(async (planId: string): Promise<SavingsPot[]> => {
    const raw = await SecureStore.getItemAsync(SAVINGS_POTS_KEY);
    const store = parseSavingsPotStore(raw);
    const localPots = Array.isArray(store[planId]) ? store[planId] : [];

    try {
      const remote = await apiFetch<{ pots?: unknown[] }>(`${SAVINGS_POTS_ENDPOINT}?budgetPlanId=${encodeURIComponent(planId)}`);
      const remotePots = Array.isArray(remote?.pots)
        ? remote.pots
          .map((pot, index) => normalizeSavingsPot(planId, pot, index))
          .filter((pot): pot is SavingsPot => Boolean(pot))
        : [];

      const localInvestmentCount = countInvestmentPots(localPots);
      const remoteInvestmentCount = countInvestmentPots(remotePots);
      const shouldPreferLocalInvestmentSplit =
        localInvestmentCount > remoteInvestmentCount
        && localInvestmentCount > 1;

      if (remotePots.length > 0) {
        if (shouldPreferLocalInvestmentSplit) {
          // Keep local investment buckets when remote state is stale/partial.
          void syncSavingsPotsToServer(planId, localPots).catch(() => undefined);
          return localPots;
        }

        await writeSavingsPotsToLocalStore(planId, remotePots);
        return remotePots;
      }

      if (localPots.length > 0) {
        void syncSavingsPotsToServer(planId, localPots).catch(() => undefined);
      }

      return localPots;
    } catch {
      return localPots;
    }
  }, [syncSavingsPotsToServer, writeSavingsPotsToLocalStore]);

  const writeSavingsPotsForPlan = useCallback(async (planId: string, pots: SavingsPot[]): Promise<void> => {
    const normalizedPots = pots
      .map((pot, index) => normalizeSavingsPot(planId, pot, index))
      .filter((pot): pot is SavingsPot => Boolean(pot));

    await writeSavingsPotsToLocalStore(planId, normalizedPots);

    try {
      await syncSavingsPotsToServer(planId, normalizedPots);
    } catch {
      // Local write succeeded; server sync will retry on the next read/write.
    }
  }, [syncSavingsPotsToServer, writeSavingsPotsToLocalStore]);

  const ensureSavingsPotAllocationLinks = useCallback(async (planId: string, pots: SavingsPot[]): Promise<SavingsPot[]> => {
    const missingLinks = pots.filter((pot) => pot.field !== "investment" && !pot.allocationId);
    if (missingLinks.length === 0) return pots;

    const now = new Date();
    let didUpdate = false;
    const syncedPots = [...pots];

    for (let i = 0; i < syncedPots.length; i += 1) {
      const pot = syncedPots[i];
      if (!pot || pot.field === "investment" || pot.allocationId) continue;

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
