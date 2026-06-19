import test from "node:test";
import assert from "node:assert/strict";

import {
  isLegacyBackfilledSacrificeGoal,
  resolvePreferredInvestmentGoalId,
  resolveLegacySacrificeGoalConfig,
  shouldCanonicalizeInvestmentSacrificeGoal,
} from "./goalLinks";

test("shouldCanonicalizeInvestmentSacrificeGoal treats common investment buckets as shared investment goals", () => {
  assert.equal(shouldCanonicalizeInvestmentSacrificeGoal("Stocks"), true);
  assert.equal(shouldCanonicalizeInvestmentSacrificeGoal("Crypto"), true);
  assert.equal(shouldCanonicalizeInvestmentSacrificeGoal("Brokerage account"), true);
});

test("shouldCanonicalizeInvestmentSacrificeGoal leaves non-investment custom sacrifices alone", () => {
  assert.equal(shouldCanonicalizeInvestmentSacrificeGoal("Holiday savings"), false);
  assert.equal(shouldCanonicalizeInvestmentSacrificeGoal("Smoke"), false);
});

test("resolveLegacySacrificeGoalConfig marks investment buckets for auto-linking only", () => {
  const config = resolveLegacySacrificeGoalConfig("Stocks");

  assert.equal(config.category, "investment");
  assert.equal(config.shouldAutoLink, true);
});

test("resolveLegacySacrificeGoalConfig leaves non-investment custom sacrifices unlinked", () => {
  const config = resolveLegacySacrificeGoalConfig("Pay Back Debts");

  assert.equal(config.category, "debt");
  assert.equal(config.shouldAutoLink, false);
});

test("resolvePreferredInvestmentGoalId prefers a real targeted investment goal over placeholders", () => {
  const goalId = resolvePreferredInvestmentGoalId([
    {
      id: "placeholder",
      title: "Investments",
      category: "investment",
      description: "Backfilled from an older custom sacrifice. Update the target amount and year if needed.",
      targetYear: null,
    },
    {
      id: "real-goal",
      title: "Stocks Investments",
      category: "investment",
      description: null,
      targetYear: 2031,
    },
  ]);

  assert.equal(goalId, "real-goal");
});

test("isLegacyBackfilledSacrificeGoal identifies placeholder no-target-year goals", () => {
  assert.equal(isLegacyBackfilledSacrificeGoal({
    description: "Backfilled from an older custom sacrifice. Update the target amount and year if needed.",
    targetYear: null,
  }), true);

  assert.equal(isLegacyBackfilledSacrificeGoal({
    description: null,
    targetYear: 2031,
  }), false);
});