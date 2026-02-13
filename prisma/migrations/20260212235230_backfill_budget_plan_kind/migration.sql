-- Backfill BudgetPlan.kind based on existing legacy name values.
-- Previously, the app stored the type in BudgetPlan.name (personal/holiday/carnival).

UPDATE "BudgetPlan"
SET "kind" = CASE
  WHEN lower("name") = 'holiday' THEN 'holiday'::"BudgetPlanKind"
  WHEN lower("name") = 'carnival' THEN 'carnival'::"BudgetPlanKind"
  WHEN lower("name") = 'personal' THEN 'personal'::"BudgetPlanKind"
  ELSE "kind"
END;
