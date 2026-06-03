import { describe, expect, it } from "vitest";

import { reconcileMissingInvestmentSplitPots } from "@/lib/helpers/settings";
import type { SavingsPot } from "@/types/settings";

const SPLIT_BUCKETS = [
  { name: "Stocks", amount: 362.91 },
  { name: "Crypto", amount: 200 },
] as const;

describe("reconcileMissingInvestmentSplitPots", () => {
  it("rebuilds a missing split bucket when only one canonical investment pot remains", () => {
    const pots: SavingsPot[] = [
      {
        id: "crypto-1",
        field: "investment",
        name: "Crypto",
        amount: 200,
        broker: "none",
      },
      {
        id: "savings-1",
        field: "savings",
        name: "Main Savings",
        amount: 150,
        broker: "none",
      },
    ];

    const reconciled = reconcileMissingInvestmentSplitPots({
      pots,
      investmentBalance: 562.91,
      splitBuckets: SPLIT_BUCKETS,
      planId: "plan-123",
    });

    expect(reconciled).not.toBeNull();
    const investmentPots = reconciled!.filter((pot) => pot.field === "investment");
    expect(investmentPots).toHaveLength(2);

    const stocks = investmentPots.find((pot) => pot.name === "Stocks");
    const crypto = investmentPots.find((pot) => pot.name === "Crypto");

    expect(crypto?.id).toBe("crypto-1");
    expect(crypto?.amount).toBe(200);
    expect(stocks?.amount).toBeCloseTo(362.91, 6);
    expect(reconciled!.some((pot) => pot.id === "savings-1")).toBe(true);
  });

  it("uses remaining balance when the missing bucket amount has drifted from defaults", () => {
    const pots: SavingsPot[] = [
      {
        id: "stocks-1",
        field: "investment",
        name: "Stocks",
        amount: 361,
        broker: "none",
      },
    ];

    const reconciled = reconcileMissingInvestmentSplitPots({
      pots,
      investmentBalance: 562.91,
      splitBuckets: SPLIT_BUCKETS,
      planId: "plan-123",
    });

    expect(reconciled).not.toBeNull();
    const investmentPots = reconciled!.filter((pot) => pot.field === "investment");
    const crypto = investmentPots.find((pot) => pot.name === "Crypto");
    expect(crypto?.amount).toBeCloseTo(201.91, 6);
  });

  it("does not modify pots when investment buckets are custom", () => {
    const pots: SavingsPot[] = [
      {
        id: "etf-1",
        field: "investment",
        name: "ETF",
        amount: 562.91,
        broker: "none",
      },
    ];

    const reconciled = reconcileMissingInvestmentSplitPots({
      pots,
      investmentBalance: 562.91,
      splitBuckets: SPLIT_BUCKETS,
      planId: "plan-123",
    });

    expect(reconciled).toBeNull();
  });
});
