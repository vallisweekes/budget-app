-- Add per-user navigation state persistence (mobile resume across devices)

ALTER TABLE "User"
ADD COLUMN "navStateJson" TEXT,
ADD COLUMN "navStateUpdatedAt" TIMESTAMP(3);
