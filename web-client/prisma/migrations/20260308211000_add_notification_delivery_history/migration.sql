CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetPlanId" TEXT,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'low',
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "metadataJson" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDelivery_userId_sentAt_idx" ON "NotificationDelivery"("userId", "sentAt");
CREATE INDEX "NotificationDelivery_userId_type_sentAt_idx" ON "NotificationDelivery"("userId", "type", "sentAt");
CREATE INDEX "NotificationDelivery_budgetPlanId_sentAt_idx" ON "NotificationDelivery"("budgetPlanId", "sentAt");

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_budgetPlanId_fkey"
FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;