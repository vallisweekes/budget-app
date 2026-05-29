import { describe, expect, it } from "vitest";

import { getFutureExpensePaymentWarning } from "@/lib/domain/paymentRules";

describe("getFutureExpensePaymentWarning", () => {
  it("returns a warning when the expense belongs to a future pay period", () => {
    const warning = getFutureExpensePaymentWarning({
      dueDate: "2026-06-27",
      payDate: 27,
      payFrequency: "every_4_weeks",
      payAnchorDate: "2026-05-27T00:00:00.000Z",
      planCreatedAt: "2026-05-29T18:50:33.851Z",
      now: new Date("2026-05-29T12:00:00.000Z"),
    });

    expect(warning).toMatchObject({
      title: "Mark as paid early?",
      periodLabel: "24 Jun - 21 Jul",
    });
    expect(warning?.description).toContain("24 Jun - 21 Jul");
  });

  it("returns null when today is already inside that pay period", () => {
    expect(getFutureExpensePaymentWarning({
      dueDate: "2026-06-27",
      payDate: 27,
      payFrequency: "every_4_weeks",
      payAnchorDate: "2026-05-27T00:00:00.000Z",
      planCreatedAt: "2026-05-29T18:50:33.851Z",
      now: new Date("2026-06-28T12:00:00.000Z"),
    })).toBeNull();
  });
});