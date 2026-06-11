import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveDisplayedExpensePaidState,
  shouldForceUnpaidForSelectedPeriod,
} from "./payPeriodPaidState";

test("shouldForceUnpaidForSelectedPeriod returns true for future pay period", () => {
  const futureStart = new Date("2099-01-27T00:00:00.000Z");
  const result = shouldForceUnpaidForSelectedPeriod({
    scope: "pay_period",
    selectedPeriodStart: futureStart,
    nowMs: new Date("2099-01-01T00:00:00.000Z").getTime(),
  });

  assert.equal(result, true);
});

test("resolveDisplayedExpensePaidState forces unpaid in future pay period", () => {
  const paidState = resolveDisplayedExpensePaidState({
    scope: "pay_period",
    selectedPeriodStart: new Date("2099-01-27T00:00:00.000Z"),
    nowMs: new Date("2099-01-01T00:00:00.000Z").getTime(),
    plannedAmount: 100,
    canonicalPaidAmount: 100,
    canonicalIsPaid: true,
  });

  assert.deepEqual(paidState, { paidAmount: 0, isPaid: false });
});

test("resolveDisplayedExpensePaidState uses canonical values in current/past period", () => {
  const paidState = resolveDisplayedExpensePaidState({
    scope: "pay_period",
    selectedPeriodStart: new Date("2026-05-27T00:00:00.000Z"),
    nowMs: new Date("2026-06-10T00:00:00.000Z").getTime(),
    plannedAmount: 100,
    canonicalPaidAmount: 70,
    canonicalIsPaid: false,
  });

  assert.deepEqual(paidState, { paidAmount: 70, isPaid: false });
});

test("resolveDisplayedExpensePaidState clamps paid amount to planned amount", () => {
  const paidState = resolveDisplayedExpensePaidState({
    scope: "month",
    selectedPeriodStart: null,
    plannedAmount: 100,
    canonicalPaidAmount: 180,
    canonicalIsPaid: true,
  });

  assert.deepEqual(paidState, { paidAmount: 100, isPaid: true });
});

test("resolveDisplayedExpensePaidState falls back when canonical values are missing", () => {
  const paidState = resolveDisplayedExpensePaidState({
    scope: "month",
    selectedPeriodStart: null,
    plannedAmount: 100,
    fallbackPaidAmount: 40,
    fallbackIsPaid: false,
  });

  assert.deepEqual(paidState, { paidAmount: 40, isPaid: false });
});
