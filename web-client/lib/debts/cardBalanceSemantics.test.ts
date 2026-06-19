import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCreditLikeCurrentBalance } from "./cardBalanceSemantics";

test("normalizeCreditLikeCurrentBalance preserves standard credit card balances", () => {
  const result = normalizeCreditLikeCurrentBalance({
    type: "credit_card",
    currentBalance: 1333.72,
    creditLimit: 3000,
    trackedExpenseCharges: 1333.72,
    trackedDebtCharges: 0,
    trackedPayments: 0,
  });

  assert.equal(result, 1333.72);
});

test("normalizeCreditLikeCurrentBalance removes a legacy credit-limit offset when tracked card spending proves it", () => {
  const result = normalizeCreditLikeCurrentBalance({
    type: "credit_card",
    currentBalance: 4333.72,
    creditLimit: 3000,
    trackedExpenseCharges: 1333.72,
    trackedDebtCharges: 0,
    trackedPayments: 0,
  });

  assert.equal(result, 1333.72);
});

test("normalizeCreditLikeCurrentBalance does not hide a real over-limit balance when tracked activity matches stored debt", () => {
  const result = normalizeCreditLikeCurrentBalance({
    type: "credit_card",
    currentBalance: 3200,
    creditLimit: 3000,
    trackedExpenseCharges: 3200,
    trackedDebtCharges: 0,
    trackedPayments: 0,
  });

  assert.equal(result, 3200);
});